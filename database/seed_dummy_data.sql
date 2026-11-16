USE sdirectSDD2026;
GO

-- ======================================================================
-- Healthcare Management System - Rich Dummy Data Population
-- Target Database: sdirectSDD2026 on (localdb)\mssqllocaldb
-- ======================================================================

DECLARE @DoctorRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Doctor');
DECLARE @NurseRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Nurse');
DECLARE @PatientRoleId INT = (SELECT RoleId FROM Roles_Raj WHERE RoleName = 'Patient');

-- SHA256 Hashes:
-- Doctor@123  : 63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850
-- Nurse@123   : 07429ac3dabe393512f2633b9514473ec7fc452dd202eb7735e60b900d273fd3
-- Patient@123 : 6dff47814e92e3a14c9f021d2d3ddd353a03e5bf3b0f49d53e80a1a3606c86d6

-- 1. ADDITIONAL DOCTORS
IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'doctor.david@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Dr. David Miller (MS, Orthopedics)', 'doctor.david@hospital.com', '63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850', @DoctorRoleId, '+1 555-0103', 1, GETDATE());
END

IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'doctor.ananya@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Dr. Ananya Iyer (DM, Neurology)', 'doctor.ananya@hospital.com', '63bbe564aa5c0882355f6dcd6f2241b6f8d02d6f39725966ae564cd310f07850', @DoctorRoleId, '+91 9811223344', 1, GETDATE());
END

-- 2. ADDITIONAL NURSE
IF NOT EXISTS (SELECT 1 FROM Users_Raj WHERE Email = 'nurse.rohit@hospital.com')
BEGIN
    INSERT INTO Users_Raj (FullName, Email, PasswordHash, RoleId, PhoneNumber, IsActive, CreatedAt)
    VALUES ('Nurse Rohit Verma (RN, Emergency Triage)', 'nurse.rohit@hospital.com', '07429ac3dabe393512f2633b9514473ec7fc452dd202eb7735e60b900d273fd3', @NurseRoleId, '+91 9822334455', 1, GETDATE());
END
GO

-- 3. DIVERSE PATIENT RECORDS
-- Patient 4: Sunita Rao
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'sunita.rao@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mrs.', 'Sunita', 'Rao', '+91 9765432109', 'sunita.rao@example.com', 'Osteoarthritis in knee joints since 2019', 'Severe right knee swelling and pain while walking', '8899-1122-3344', '1968-04-12', 58, 0, DATEADD(DAY, -20, GETDATE()));
END

-- Patient 5: Kevin Peterson
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'kevin.p@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mr.', 'Kevin', 'Peterson', '+1 555-0144', 'kevin.p@example.com', 'GERD & Acidity', 'Chronic acid reflux and burning sensation in epigastrium', '3344-5566-7788', '1990-09-25', 36, 0, DATEADD(DAY, -15, GETDATE()));
END

-- Patient 6: Meera Patel
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'meera.patel@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Ms.', 'Meera', 'Patel', '+91 9654321098', 'meera.patel@example.com', 'Chronic Migraine with Aura', 'Unilateral throbbing headache with photophobia and nausea', '5566-7788-9900', '1996-03-18', 30, 0, DATEADD(DAY, -12, GETDATE()));
END

-- Patient 7: Dr. Vikram Malhotra
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'vikram.m@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Dr.', 'Vikram', 'Malhotra', '+91 9543210987', 'vikram.m@example.com', 'Hyperlipidemia & Family history of CAD', 'Routine annual executive cardiac screening', '7788-9900-1122', '1975-12-05', 51, 0, DATEADD(DAY, -8, GETDATE()));
END

-- Patient 8: Ananya Sengupta
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'ananya.s@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mrs.', 'Ananya', 'Sengupta', '+91 9432109876', 'ananya.s@example.com', 'Hypothyroidism', 'Fatigue, unexplained weight gain and cold intolerance', '9900-1122-3344', '1988-07-22', 38, 0, DATEADD(DAY, -5, GETDATE()));
END

-- Patient 9: Mohammed Rizwan
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'mohammed.r@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Mr.', 'Mohammed', 'Rizwan', '+91 9321098765', 'mohammed.r@example.com', 'Mild lumbar spondylosis', 'Lower back stiffness radiating to left hip after lifting weight', '2233-4455-6677', '1982-10-30', 44, 0, DATEADD(DAY, -2, GETDATE()));
END

-- Patient 10: Kavita Nair
IF NOT EXISTS (SELECT 1 FROM Patients_Raj WHERE Email = 'kavita.nair@example.com')
BEGIN
    INSERT INTO Patients_Raj (UserId, Prefix, FirstName, LastName, PhoneNumber, Email, AnyMedicalHistory, Problem, AdharNumber, DateOfBirth, Age, IsDeleted, CreatedAt)
    VALUES (NULL, 'Ms.', 'Kavita', 'Nair', '+91 9210987654', 'kavita.nair@example.com', 'Peanut allergy', 'Skin rash and facial pruritus after eating meal', '6677-8899-0011', '2001-02-14', 25, 0, GETDATE());
END
GO

-- 4. VITALS FOR MULTIPLE PATIENTS
DECLARE @Pat2Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'priya.verma@example.com');
DECLARE @Pat4Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'sunita.rao@example.com');
DECLARE @Pat5Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'kevin.p@example.com');
DECLARE @Pat6Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'meera.patel@example.com');

IF @Pat2Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientVitals_Raj WHERE PatientId = @Pat2Id)
BEGIN
    INSERT INTO PatientVitals_Raj (PatientId, BloodPressure, HeartRate, Temperature, Weight, RecordedDate, RecordedBy)
    VALUES 
    (@Pat2Id, '138/88 mmHg', 84, 99.1, 68.0, DATEADD(DAY, -5, GETDATE()), 'Nurse Rohit Verma'),
    (@Pat2Id, '130/82 mmHg', 78, 98.6, 67.5, GETDATE(), 'Nurse Emily Clark');
END

IF @Pat4Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientVitals_Raj WHERE PatientId = @Pat4Id)
BEGIN
    INSERT INTO PatientVitals_Raj (PatientId, BloodPressure, HeartRate, Temperature, Weight, RecordedDate, RecordedBy)
    VALUES 
    (@Pat4Id, '142/90 mmHg', 80, 98.4, 78.5, DATEADD(DAY, -3, GETDATE()), 'Nurse Emily Clark'),
    (@Pat4Id, '136/86 mmHg', 76, 98.2, 78.0, GETDATE(), 'Nurse Rohit Verma');
END

IF @Pat5Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientVitals_Raj WHERE PatientId = @Pat5Id)
BEGIN
    INSERT INTO PatientVitals_Raj (PatientId, BloodPressure, HeartRate, Temperature, Weight, RecordedDate, RecordedBy)
    VALUES 
    (@Pat5Id, '118/76 mmHg', 70, 98.6, 82.0, GETDATE(), 'Nurse Emily Clark');
END

IF @Pat6Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientVitals_Raj WHERE PatientId = @Pat6Id)
BEGIN
    INSERT INTO PatientVitals_Raj (PatientId, BloodPressure, HeartRate, Temperature, Weight, RecordedDate, RecordedBy)
    VALUES 
    (@Pat6Id, '110/70 mmHg', 88, 98.8, 54.5, GETDATE(), 'Nurse Rohit Verma');
END
GO

-- 5. MEDICAL HISTORIES
DECLARE @Pat2Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'priya.verma@example.com');
DECLARE @Pat4Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'sunita.rao@example.com');
DECLARE @Pat6Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'meera.patel@example.com');

IF @Pat2Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientMedicalHistories_Raj WHERE PatientId = @Pat2Id)
BEGIN
    INSERT INTO PatientMedicalHistories_Raj (PatientId, Condition, DiagnosisDate, Treatment, Notes, RecordedDate)
    VALUES 
    (@Pat2Id, 'Type 2 Diabetes Mellitus', '2020-06-15', 'Metformin 500mg BID', 'HbA1c last recorded at 7.2%. Dietary modification advised.', DATEADD(DAY, -30, GETDATE()));
END

IF @Pat4Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientMedicalHistories_Raj WHERE PatientId = @Pat4Id)
BEGIN
    INSERT INTO PatientMedicalHistories_Raj (PatientId, Condition, DiagnosisDate, Treatment, Notes, RecordedDate)
    VALUES 
    (@Pat4Id, 'Bilateral Knee Osteoarthritis (Grade 3)', '2019-11-20', 'Physiotherapy & Paracetamol SOS', 'Restricted high-impact exercises. Weight bearing limited.', DATEADD(DAY, -20, GETDATE()));
END

IF @Pat6Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PatientMedicalHistories_Raj WHERE PatientId = @Pat6Id)
BEGIN
    INSERT INTO PatientMedicalHistories_Raj (PatientId, Condition, DiagnosisDate, Treatment, Notes, RecordedDate)
    VALUES 
    (@Pat6Id, 'Migraine without Aura', '2022-01-10', 'Sumatriptan 50mg PRN', 'Triggered by stress, bright screen lights, and dehydration.', DATEADD(DAY, -10, GETDATE()));
END
GO

-- 6. APPOINTMENTS IN DIFFERENT WORKFLOW STATES
DECLARE @Doc1Id INT = (SELECT UserId FROM Users_Raj WHERE Email = 'doctor@hospital.com');
DECLARE @Doc2Id INT = (SELECT UserId FROM Users_Raj WHERE Email = 'doctor.david@hospital.com');
DECLARE @Doc3Id INT = (SELECT UserId FROM Users_Raj WHERE Email = 'doctor.ananya@hospital.com');

DECLARE @Pat1Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'patient@hospital.com');
DECLARE @Pat2Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'priya.verma@example.com');
DECLARE @Pat4Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'sunita.rao@example.com');
DECLARE @Pat5Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'kevin.p@example.com');
DECLARE @Pat6Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'meera.patel@example.com');
DECLARE @Pat7Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'vikram.m@example.com');

-- 1) New Incoming Requests (For Nurse to review and approve!)
IF @Pat4Id IS NOT NULL AND @Doc2Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Pat4Id)
BEGIN
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Pat4Id, @Doc2Id, CAST(GETDATE() + 1 AS DATE), '11:30 AM', 'Severe knee pain and stiffness in morning', 'Requested', 'Patient requested morning orthopedic slot', GETDATE());
END

IF @Pat6Id IS NOT NULL AND @Doc3Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Pat6Id)
BEGIN
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Pat6Id, @Doc3Id, CAST(GETDATE() + 2 AS DATE), '03:30 PM', 'Recurrent migraine attacks over past 4 days', 'Requested', 'First visit to neurology department', GETDATE());
END

-- 2) NurseApproved (Ready for Doctor to Confirm!)
IF @Pat5Id IS NOT NULL AND @Doc1Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Pat5Id)
BEGIN
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Pat5Id, @Doc1Id, CAST(GETDATE() + 1 AS DATE), '10:00 AM', 'Reflux and post-meal heartburn', 'NurseApproved', 'Vitals checked by Nurse Emily Clark: BP 118/76. Forwarded to Doctor.', GETDATE());
END

-- 3) DoctorConfirmed (On the Doctor's schedule!)
IF @Pat7Id IS NOT NULL AND @Doc1Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Pat7Id)
BEGIN
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Pat7Id, @Doc1Id, CAST(GETDATE() + 4 AS DATE), '09:00 AM', 'Executive Annual Cardiac Health Evaluation', 'DoctorConfirmed', 'Confirmed by Dr. Sarah Johnson. Fasting lipid profile required before visit.', GETDATE());
END

-- 4) Rescheduled
DECLARE @Pat3Id INT = (SELECT TOP 1 PatientID FROM Patients_Raj WHERE Email = 'amit.kumar@example.com');
IF @Pat3Id IS NOT NULL AND @Doc1Id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Appointments_Raj WHERE PatientId = @Pat3Id)
BEGIN
    INSERT INTO Appointments_Raj (PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status, Notes, CreatedAt)
    VALUES (@Pat3Id, @Doc1Id, CAST(GETDATE() + 5 AS DATE), '02:00 PM', 'Persistent asthma symptoms and wheezing', 'Rescheduled', 'Rescheduled: Patient requested afternoon slot due to office schedule.', GETDATE());
END
GO
