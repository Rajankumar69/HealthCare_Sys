USE HealthcareDb_Raj;
GO

-- ======================================================================
-- STORED PROCEDURES (with proper AS BEGIN ... END syntax)
-- ======================================================================

-- SP 1: Paginated Patient list for Doctor and Nurse with Soft-Delete check
CREATE OR ALTER PROCEDURE sp_GetPaginatedPatients_Raj
    @PageNumber INT = 1,
    @PageSize INT = 10,
    @SearchTerm NVARCHAR(100) = NULL,
    @TotalCount INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize < 1 SET @PageSize = 10;

    -- Count total records matching filter
    SELECT @TotalCount = COUNT(1)
    FROM Patients_Raj
    WHERE IsDeleted = 0
      AND (@SearchTerm IS NULL 
           OR FirstName LIKE '%' + @SearchTerm + '%'
           OR LastName LIKE '%' + @SearchTerm + '%'
           OR Email LIKE '%' + @SearchTerm + '%'
           OR PhoneNumber LIKE '%' + @SearchTerm + '%'
           OR AdharNumber LIKE '%' + @SearchTerm + '%');

    -- Return paginated page
    SELECT 
        PatientID,
        UserId,
        Prefix,
        FirstName,
        LastName,
        Gender,
        PhoneNumber,
        Email,
        AnyMedicalHistory,
        Problem,
        AdharNumber,
        DateOfBirth,
        Age,
        IsDeleted,
        CreatedAt,
        UpdatedAt
    FROM Patients_Raj
    WHERE IsDeleted = 0
      AND (@SearchTerm IS NULL 
           OR FirstName LIKE '%' + @SearchTerm + '%'
           OR LastName LIKE '%' + @SearchTerm + '%'
           OR Email LIKE '%' + @SearchTerm + '%'
           OR PhoneNumber LIKE '%' + @SearchTerm + '%'
           OR AdharNumber LIKE '%' + @SearchTerm + '%')
    ORDER BY PatientID DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- SP 2: Soft delete patient
CREATE OR ALTER PROCEDURE sp_SoftDeletePatient_Raj
    @PatientID INT,
    @UpdatedBy NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Patients_Raj
    SET IsDeleted = 1,
        UpdatedAt = GETDATE(),
        UpdatedBy = @UpdatedBy
    WHERE PatientID = @PatientID;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

-- SP 3: Save OTP for Forgot Password with 30-second expiry
CREATE OR ALTER PROCEDURE sp_SaveOrUpdateOtp_Raj
    @Email NVARCHAR(150),
    @Otp NVARCHAR(10),
    @Success BIT OUTPUT,
    @Message NVARCHAR(250) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @UserId INT;

    SELECT @UserId = UserId FROM Users_Raj WHERE Email = @Email AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        SET @Success = 0;
        SET @Message = 'User with this email was not found.';
        RETURN;
    END

    -- Deactivate older unused OTPs for this user
    UPDATE PasswordResets_Raj 
    SET IsUsed = 1 
    WHERE UserId = @UserId AND IsUsed = 0;

    -- Insert new OTP with 30-second expiration time
    INSERT INTO PasswordResets_Raj (UserId, Email, Otp, ExpiryTime, IsUsed, CreatedAt, CreatedBy)
    VALUES (@UserId, @Email, @Otp, DATEADD(SECOND, 30, GETDATE()), 0, GETDATE(), @Email);

    SET @Success = 1;
    SET @Message = 'OTP generated successfully, valid for 30 seconds.';
END
GO

-- SP 3.5: Verify OTP
CREATE OR ALTER PROCEDURE sp_VerifyOtp_Raj
    @Email NVARCHAR(150),
    @Otp NVARCHAR(10),
    @Success BIT OUTPUT,
    @Message NVARCHAR(250) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ResetId INT;
    DECLARE @ExpiryTime DATETIME;

    SELECT TOP 1 
        @ResetId = ResetId,
        @ExpiryTime = ExpiryTime
    FROM PasswordResets_Raj
    WHERE Email = @Email AND Otp = @Otp AND IsUsed = 0
    ORDER BY ResetId DESC;

    IF @ResetId IS NULL
    BEGIN
        SET @Success = 0;
        SET @Message = 'Invalid OTP or OTP has already been used.';
        RETURN;
    END

    -- Check 30-second expiry
    IF GETDATE() > @ExpiryTime
    BEGIN
        SET @Success = 0;
        SET @Message = 'OTP has expired (validity is 30 seconds). Please request a new OTP.';
        UPDATE PasswordResets_Raj SET IsUsed = 1 WHERE ResetId = @ResetId;
        RETURN;
    END

    -- Extend expiry by 5 minutes upon successful verification so user can set new password
    UPDATE PasswordResets_Raj
    SET ExpiryTime = DATEADD(MINUTE, 5, GETDATE())
    WHERE ResetId = @ResetId;

    SET @Success = 1;
    SET @Message = 'OTP verified successfully.';
END
GO

-- SP 4: Verify OTP and Reset Password in Users_Raj
CREATE OR ALTER PROCEDURE sp_VerifyOtpAndResetPassword_Raj
    @Email NVARCHAR(150),
    @Otp NVARCHAR(10),
    @NewPasswordHash NVARCHAR(500),
    @Success BIT OUTPUT,
    @Message NVARCHAR(250) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ResetId INT;
    DECLARE @UserId INT;
    DECLARE @ExpiryTime DATETIME;

    SELECT TOP 1 
        @ResetId = ResetId,
        @UserId = UserId,
        @ExpiryTime = ExpiryTime
    FROM PasswordResets_Raj
    WHERE Email = @Email AND Otp = @Otp AND IsUsed = 0
    ORDER BY ResetId DESC;

    IF @ResetId IS NULL
    BEGIN
        SET @Success = 0;
        SET @Message = 'Invalid OTP or OTP has already been used.';
        RETURN;
    END

    -- Check 30-second expiry
    IF GETDATE() > @ExpiryTime
    BEGIN
        SET @Success = 0;
        SET @Message = 'OTP has expired (validity is 30 seconds). Please request a new OTP.';
        -- Mark as used since expired
        UPDATE PasswordResets_Raj SET IsUsed = 1 WHERE ResetId = @ResetId;
        RETURN;
    END

    -- Mark OTP as used
    UPDATE PasswordResets_Raj 
    SET IsUsed = 1 
    WHERE ResetId = @ResetId;

    -- Update Password in Users_Raj
    UPDATE Users_Raj
    SET PasswordHash = @NewPasswordHash,
        UpdatedAt = GETDATE()
    WHERE UserId = @UserId;

    SET @Success = 1;
    SET @Message = 'Password has been successfully updated.';
END
GO

-- SP 5: Get full patient details (details, vitals, medical history)
CREATE OR ALTER PROCEDURE sp_GetPatientFullDetails_Raj
    @PatientID INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Result 1: Patient details
    SELECT 
        PatientID,
        UserId,
        Prefix,
        FirstName,
        LastName,
        Gender,
        PhoneNumber,
        Email,
        AnyMedicalHistory,
        Problem,
        AdharNumber,
        DateOfBirth,
        Age,
        IsDeleted,
        CreatedAt,
        UpdatedAt
    FROM Patients_Raj
    WHERE PatientID = @PatientID AND IsDeleted = 0;

    -- Result 2: Patient vitals
    SELECT 
        VitalId,
        PatientId,
        BloodPressure,
        HeartRate,
        Temperature,
        Weight,
        RecordedDate,
        RecordedBy
    FROM PatientVitals_Raj
    WHERE PatientId = @PatientID
    ORDER BY RecordedDate DESC;

    -- Result 3: Patient medical history
    SELECT 
        HistoryId,
        PatientId,
        Condition,
        DiagnosisDate,
        Treatment,
        Notes,
        RecordedDate
    FROM PatientMedicalHistories_Raj
    WHERE PatientId = @PatientID
    ORDER BY RecordedDate DESC;
END
GO
