-- ======================================================================
-- Healthcare Management System - Database Creation Script for sdirectSDD2026
-- Target: (localdb)\mssqllocaldb
-- All tables follow the convention: tablename_Raj
-- ======================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'sdirectSDD2026')
BEGIN
    CREATE DATABASE sdirectSDD2026;
END
GO

USE sdirectSDD2026;
GO

-- 1. Roles_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles_Raj')
BEGIN
    CREATE TABLE Roles_Raj (
        RoleId INT IDENTITY(1,1) PRIMARY KEY,
        RoleName NVARCHAR(50) NOT NULL UNIQUE
    );
END
GO

-- 2. Users_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users_Raj')
BEGIN
    CREATE TABLE Users_Raj (
        UserId INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(150) NOT NULL,
        Email NVARCHAR(150) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        RoleId INT NOT NULL,
        PhoneNumber NVARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_Users_Roles_Raj FOREIGN KEY (RoleId) REFERENCES Roles_Raj(RoleId)
    );
END
GO

-- 3. Patients_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Patients_Raj')
BEGIN
    CREATE TABLE Patients_Raj (
        PatientID INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Prefix NVARCHAR(20) NOT NULL,           -- Mr., Mrs., Ms., Dr.
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Gender NVARCHAR(20) NULL,
        PhoneNumber NVARCHAR(50) NOT NULL,
        Email NVARCHAR(150) NOT NULL,
        AnyMedicalHistory NVARCHAR(MAX) NULL,
        Problem NVARCHAR(MAX) NULL,
        AdharNumber NVARCHAR(50) NOT NULL,
        DateOfBirth DATE NOT NULL,
        Age INT NOT NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,       -- Soft delete requirement
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CreatedBy NVARCHAR(100) NULL,
        UpdatedBy NVARCHAR(100) NULL,
        DeletedBy NVARCHAR(100) NULL,
        DeletedDate DATETIME NULL,
        CONSTRAINT FK_Patients_Users_Raj FOREIGN KEY (UserId) REFERENCES Users_Raj(UserId)
    );
END
GO

-- 4. Appointments_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Appointments_Raj')
BEGIN
    CREATE TABLE Appointments_Raj (
        AppointmentId INT IDENTITY(1,1) PRIMARY KEY,
        PatientId INT NOT NULL,
        DoctorId INT NOT NULL,
        AppointmentDate DATE NOT NULL,
        AppointmentTime NVARCHAR(50) NOT NULL,
        Reason NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Requested', -- Requested, NurseApproved, DoctorConfirmed, Rescheduled, Cancelled
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_Appointments_Patients_Raj FOREIGN KEY (PatientId) REFERENCES Patients_Raj(PatientID),
        CONSTRAINT FK_Appointments_Doctors_Raj FOREIGN KEY (DoctorId) REFERENCES Users_Raj(UserId)
    );
END
GO

-- 5. PasswordResets_Raj Table (Email and OTP for reset password functionality with 30s expiry)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResets_Raj')
BEGIN
    CREATE TABLE PasswordResets_Raj (
        ResetId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Email NVARCHAR(150) NOT NULL,
        Otp NVARCHAR(10) NOT NULL,
        ExpiryTime DATETIME NOT NULL,
        IsUsed BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL,
        CONSTRAINT FK_PasswordResets_Users_Raj FOREIGN KEY (UserId) REFERENCES Users_Raj(UserId)
    );
END
GO

-- 6. PatientVitals_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PatientVitals_Raj')
BEGIN
    CREATE TABLE PatientVitals_Raj (
        VitalId INT IDENTITY(1,1) PRIMARY KEY,
        PatientId INT NOT NULL,
        BloodPressure NVARCHAR(50) NOT NULL,     -- e.g. 120/80 mmHg
        HeartRate INT NOT NULL,                 -- bpm
        Temperature DECIMAL(5,2) NOT NULL,      -- °F
        Weight DECIMAL(5,2) NOT NULL,           -- kg
        RecordedDate DATETIME NOT NULL DEFAULT GETDATE(),
        RecordedBy NVARCHAR(100) NULL,
        CONSTRAINT FK_PatientVitals_Patients_Raj FOREIGN KEY (PatientId) REFERENCES Patients_Raj(PatientID)
    );
END
GO

-- 7. PatientMedicalHistories_Raj Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PatientMedicalHistories_Raj')
BEGIN
    CREATE TABLE PatientMedicalHistories_Raj (
        HistoryId INT IDENTITY(1,1) PRIMARY KEY,
        PatientId INT NOT NULL,
        Condition NVARCHAR(200) NOT NULL,
        DiagnosisDate DATE NULL,
        Treatment NVARCHAR(MAX) NULL,
        Notes NVARCHAR(MAX) NULL,
        RecordedDate DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_PatientHistories_Patients_Raj FOREIGN KEY (PatientId) REFERENCES Patients_Raj(PatientID)
    );
END
GO

-- ======================================================================
-- STORED PROCEDURES
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

-- ======================================================================
-- SEED DATA
-- Default Roles, Doctor, Nurse, Patient and sample entries
-- ======================================================================

-- 1. Insert Roles
IF NOT EXISTS (SELECT 1 FROM Roles_Raj WHERE RoleName = 'Doctor')
    INSERT INTO Roles_Raj (RoleName) VALUES ('Doctor');

IF NOT EXISTS (SELECT 1 FROM Roles_Raj WHERE RoleName = 'Nurse')
    INSERT INTO Roles_Raj (RoleName) VALUES ('Nurse');

IF NOT EXISTS (SELECT 1 FROM Roles_Raj WHERE RoleName = 'Patient')
    INSERT INTO Roles_Raj (RoleName) VALUES ('Patient');

IF NOT EXISTS (SELECT 1 FROM Roles_Raj WHERE RoleName = 'FrontDesk')
    INSERT INTO Roles_Raj (RoleName) VALUES ('FrontDesk');
GO

-- 2. Insert Default Users (SHA256 hashed passwords matching AuthService)
-- Doctor@123  : 63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850
-- Nurse@123   : 07429ac3dabe393512f2633b9514473ec7fc452dd202eb7735e60b900d273fd3
-- Patient@123 : 6dff47814e92e3a14c9f021d2d3ddd353a03e5bf3b0f49d53e80a1a3606c86d6
DECLARE @DoctorRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Doctor');
DECLARE @NurseRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Nurse');
DECLARE @PatientRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Patient');

-- Doctor User
IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'doctor@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Dr. Sarah Johnson (MD, Cardiology)', 'doctor@hospital.com', '63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850', @DoctorRoleId, '+1 555-0101', 1, GETDATE());
END
ELSE
BEGIN
    UPDATE Users_Raj SET PasswordHash = '63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850' WHERE Email = 'doctor@hospital.com';
END

-- Nurse User
IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'nurse@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Nurse Emily Clark (RN, Senior Care)', 'nurse@hospital.com', '07429ac3dabe393512f2633b9514473ec7fc452dd202eb7735e60b900d273fd3', @NurseRoleId, '+1 555-0102', 1, GETDATE());
END
ELSE
BEGIN
    UPDATE Users_Raj SET PasswordHash = '07429ac3dabe393512f2633b9514473ec7fc452dd202eb7735e60b900d273fd3' WHERE Email = 'nurse@hospital.com';
END

-- Patient User
IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'patient@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Mr. Rajesh Sharma', 'patient@hospital.com', '6dff47814e92e3a14c9f021d2d3ddd353a03e5bf3b0f49d53e80a1a3606c86d6', @PatientRoleId, '+91 9876543210', 1, GETDATE());
END
ELSE
BEGIN
    UPDATE Users_Raj SET PasswordHash = '6dff47814e92e3a14c9f021d2d3ddd353a03e5bf3b0f49d53e80a1a3606c86d6' WHERE Email = 'patient@hospital.com';
END
GO

-- 3. Insert Initial Patients
DECLARE @PatientUserId INT = (SELECT UserId FROM Users_Raj WHERE Email = 'patient@hospital.com');
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'patient@hospital.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (@PatientUserId, 'Mr.', 'Rajesh', 'Sharma', '+91 9876543210', 'patient@hospital.com', 'Mild hypertension since 2021', 'Chest discomfort and shortness of breath when climbing stairs', '1234-5678-9012', '1985-05-15', 41, 0, GETDATE());
END

-- Additional Sample Patient 2
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'priya.verma@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mrs.', 'Priya', 'Verma', '+91 9123456780', 'priya.verma@example.com', 'Type 2 Diabetes', 'Flu-like symptoms, high fever and joint pain', '9876-5432-1098', '1992-08-20', 34, 0, GETDATE());
END

-- Additional Sample Patient 3
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'amit.kumar@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mr.', 'Amit', 'Kumar', '+91 9988776655', 'amit.kumar@example.com', 'Asthma', 'Persistent dry cough and wheezing at night', '4567-8901-2345', '1998-11-10', 28, 0, GETDATE());
END
GO

-- 4. Sample Vitals and Medical History for Patient 1
DECLARE @Patient1Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'patient@hospital.com');
IF @Patient1Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientVitals_Raj WHERE PatientId = @Patient1Id)
BEGIN
    INSERT INTO PatientVitals_Raj (PatientId, BloodPressure, HeartRate, Temperature, Weight, RecordedDate, RecordedBy)
    VALUES 
    (@Patient1Id, '125/82 mmHg', 76, 98.6, 72.5, DATEADD(DAY, -10, GETDATE()), 'Nurse Emily Clark'),
    (@Patient1Id, '120/80 mmHg', 72, 98.4, 72.0, GETDATE(), 'Nurse Emily Clark');

    INSERT INTO PatientMedicalHistories_Raj (PatientId, Condition, DiagnosisDate, Treatment, Notes, RecordedDate)
    VALUES 
    (@Patient1Id, 'Essential Hypertension', '2021-03-12', 'Amlodipine 5mg daily', 'Well managed with medication', DATEADD(DAY, -10, GETDATE())),
    (@Patient1Id, 'Seasonal Allergy', '2023-04-05', 'Cetirizine as needed', 'Triggers in spring season', GETDATE());
END

-- 5. Sample Appointments
DECLARE @DoctorId INT = (SELECT UserId FROM Users_Raj WHERE Email = 'doctor@hospital.com');
IF @Patient1Id IS NOT NULL AND @DoctorId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Patient1Id)
BEGIN
    -- 1 Requested appointment (new for Nurse to approve)
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Patient1Id, @DoctorId, CAST(GETDATE() + 2 AS DATE), '10:30 AM', 'Routine cardiovascular follow up and BP check', 'Requested', 'Patient requested morning slot', GETDATE());

    -- 1 NurseApproved appointment (ready for Doctor to confirm)
    DECLARE @Patient2Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'priya.verma@example.com');
    IF @Patient2Id IS NOT NULL
    BEGIN
        INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
        VALUES (@Patient2Id, @DoctorId, CAST(GETDATE() + 3 AS DATE), '02:00 PM', 'Diabetic evaluation and diet consultation', 'NurseApproved', 'Approved by Nurse Emily Clark', GETDATE());
    END
END
GO
