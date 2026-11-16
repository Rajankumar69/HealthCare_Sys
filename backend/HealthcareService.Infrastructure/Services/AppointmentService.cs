using HealthcareService.DTOs;
using HealthcareService.Models;
using HealthcareService.Repositories;

namespace HealthcareService.Services
{
    public class AppointmentService : IAppointmentService
    {
        private readonly IAppointmentRepository _appointmentRepository;
        private readonly IPatientRepository _patientRepository;
        private readonly IAuthServiceClient _authServiceClient;

        public AppointmentService(
            IAppointmentRepository appointmentRepository,
            IPatientRepository patientRepository,
            IAuthServiceClient authServiceClient)
        {
            _appointmentRepository = appointmentRepository;
            _patientRepository = patientRepository;
            _authServiceClient = authServiceClient;
        }

        public async Task<List<AppointmentDto>> GetAppointmentsAsync(int? doctorId, int? patientId, string? status)
        {
            var list = await _appointmentRepository.GetAppointmentsAsync(doctorId, patientId, status);
            var result = new List<AppointmentDto>();

            // Cache doctor names to minimize HTTP calls
            var doctorCache = new Dictionary<int, string>();

            foreach (var item in list)
            {
                if (!doctorCache.TryGetValue(item.DoctorId, out var docName))
                {
                    var docUser = await _authServiceClient.GetUserByIdAsync(item.DoctorId);
                    docName = docUser?.FullName ?? $"Doctor #{item.DoctorId}";
                    doctorCache[item.DoctorId] = docName;
                }

                result.Add(new AppointmentDto
                {
                    AppointmentId = item.AppointmentId,
                    PatientId = item.PatientId,
                    PatientName = item.Patient != null ? $"{item.Patient.Prefix} {item.Patient.FirstName} {item.Patient.LastName}".Trim() : $"Patient #{item.PatientId}",
                    PatientPhone = item.Patient?.PhoneNumber ?? string.Empty,
                    PatientEmail = item.Patient?.Email ?? string.Empty,
                    DoctorId = item.DoctorId,
                    DoctorName = docName,
                    AppointmentDate = item.AppointmentDate,
                    AppointmentTime = item.AppointmentTime,
                    Reason = item.Reason,
                    Status = item.Status,
                    Notes = item.Notes,
                    CreatedAt = item.CreatedAt
                });
            }

            return result;
        }

        public async Task<AppointmentDto?> GetAppointmentByIdAsync(int appointmentId)
        {
            var item = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (item == null) return null;

            var docUser = await _authServiceClient.GetUserByIdAsync(item.DoctorId);
            var docName = docUser?.FullName ?? $"Doctor #{item.DoctorId}";

            return new AppointmentDto
            {
                AppointmentId = item.AppointmentId,
                PatientId = item.PatientId,
                PatientName = item.Patient != null ? $"{item.Patient.Prefix} {item.Patient.FirstName} {item.Patient.LastName}".Trim() : $"Patient #{item.PatientId}",
                PatientPhone = item.Patient?.PhoneNumber ?? string.Empty,
                PatientEmail = item.Patient?.Email ?? string.Empty,
                DoctorId = item.DoctorId,
                DoctorName = docName,
                AppointmentDate = item.AppointmentDate,
                AppointmentTime = item.AppointmentTime,
                Reason = item.Reason,
                Status = item.Status,
                Notes = item.Notes,
                CreatedAt = item.CreatedAt
            };
        }

        public async Task<AppointmentDto> CreateAppointmentAsync(CreateAppointmentDto dto)
        {
            // Validate slot is open (clinic hours, doctor leave, and not already booked)
            await EnsureSlotIsOpenAsync(dto.DoctorId, dto.AppointmentDate, dto.AppointmentTime);

            var appointment = new Appointment_Raj
            {
                PatientId = dto.PatientId,
                DoctorId = dto.DoctorId,
                AppointmentDate = dto.AppointmentDate,
                AppointmentTime = dto.AppointmentTime,
                Reason = dto.Reason,
                Status = "Approved", // Direct booking — open slot confirmed immediately without approval
                Notes = string.IsNullOrWhiteSpace(dto.Notes) ? "Booked directly (Slot confirmed)" : dto.Notes,
                CreatedAt = DateTime.UtcNow
            };

            var created = await _appointmentRepository.CreateAppointmentAsync(appointment);

            // 1. If patient provided medical history with this appointment booking:
            if (!string.IsNullOrWhiteSpace(dto.MedicalHistory))
            {
                var cond = dto.MedicalHistory.Trim();
                var trt = !string.IsNullOrWhiteSpace(dto.Treatment) ? dto.Treatment.Trim() : "Patient self-reported";
                var notes = $"Logged during consultation booking for {dto.AppointmentDate:yyyy-MM-dd}. Reason: {dto.Reason}";

                // Insert into PatientMedicalHistories_Raj table
                await _patientRepository.AddMedicalHistoryAsync(new PatientMedicalHistory_Raj
                {
                    PatientId = dto.PatientId,
                    Condition = cond,
                    DiagnosisDate = dto.AppointmentDate,
                    Treatment = trt,
                    Notes = notes,
                    RecordedDate = DateTime.UtcNow
                });
            }

            // 2. ALWAYS sync the appointment's Reason & Medical History into Patients_Raj table
            var existingPatient = await _patientRepository.GetPatientByIdAsync(dto.PatientId);
            if (existingPatient != null)
            {
                bool modified = false;

                if (!string.IsNullOrWhiteSpace(dto.Reason) && existingPatient.Problem != dto.Reason.Trim())
                {
                    existingPatient.Problem = dto.Reason.Trim();
                    modified = true;
                }

                if (!string.IsNullOrWhiteSpace(dto.MedicalHistory))
                {
                    var cond = dto.MedicalHistory.Trim();
                    if (string.IsNullOrWhiteSpace(existingPatient.AnyMedicalHistory))
                    {
                        existingPatient.AnyMedicalHistory = cond;
                        modified = true;
                    }
                    else if (!existingPatient.AnyMedicalHistory.Contains(cond, StringComparison.OrdinalIgnoreCase))
                    {
                        existingPatient.AnyMedicalHistory += $"; {cond}";
                        modified = true;
                    }
                }

                if (modified)
                {
                    var updateDto = new UpdatePatientDto
                    {
                        Prefix = existingPatient.Prefix,
                        FirstName = existingPatient.FirstName,
                        LastName = existingPatient.LastName,
                        Gender = existingPatient.Gender ?? "Male",
                        PhoneNumber = existingPatient.PhoneNumber,
                        Email = existingPatient.Email,
                        AnyMedicalHistory = existingPatient.AnyMedicalHistory,
                        Problem = existingPatient.Problem,
                        AdharNumber = existingPatient.AdharNumber ?? string.Empty,
                        DateOfBirth = existingPatient.DateOfBirth,
                        Age = existingPatient.Age
                    };
                    await _patientRepository.UpdatePatientAsync(existingPatient.PatientID, updateDto, "Patient Booking");
                }
            }

            var patient = await _patientRepository.GetPatientByIdAsync(dto.PatientId);
            var docUser = await _authServiceClient.GetUserByIdAsync(dto.DoctorId);

            return new AppointmentDto
            {
                AppointmentId = created.AppointmentId,
                PatientId = created.PatientId,
                PatientName = patient != null ? $"{patient.Prefix} {patient.FirstName} {patient.LastName}".Trim() : $"Patient #{dto.PatientId}",
                PatientPhone = patient?.PhoneNumber ?? string.Empty,
                PatientEmail = patient?.Email ?? string.Empty,
                DoctorId = created.DoctorId,
                DoctorName = docUser?.FullName ?? $"Doctor #{dto.DoctorId}",
                AppointmentDate = created.AppointmentDate,
                AppointmentTime = created.AppointmentTime,
                Reason = created.Reason,
                Status = created.Status,
                Notes = created.Notes,
                CreatedAt = created.CreatedAt
            };
        }

        public async Task<bool> FrontDeskApproveAsync(int appointmentId, string? notes)
        {
            var appt = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (appt == null) return false;

            // Status transitions to Approved (Approved exclusively by Front Desk)
            return await _appointmentRepository.UpdateStatusAsync(appointmentId, "Approved", notes ?? "Approved by Front Desk");
        }

        public async Task<bool> NurseDoneAsync(int appointmentId, string? notes)
        {
            var appt = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (appt == null) return false;

            // Status transitions to Done (completed by Nurse)
            return await _appointmentRepository.UpdateStatusAsync(appointmentId, "Done", notes ?? "Visit completed - marked Done by Nurse");
        }

        public async Task<bool> NurseApproveAsync(int appointmentId, string? notes)
        {
            // Retained for backward compatibility
            return await _appointmentRepository.UpdateStatusAsync(appointmentId, "NurseApproved", notes);
        }

        public async Task<bool> DoctorConfirmAsync(int appointmentId, string? notes)
        {
            var appt = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (appt == null) return false;

            return await _appointmentRepository.UpdateStatusAsync(appointmentId, "DoctorConfirmed", notes);
        }

        public async Task<bool> CancelAppointmentAsync(int appointmentId, string? notes)
        {
            var appt = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (appt == null) return false;

            return await _appointmentRepository.UpdateStatusAsync(appointmentId, "Cancelled", notes ?? "Cancelled");
        }

        public async Task<bool> RescheduleAsync(int appointmentId, RescheduleAppointmentDto dto)
        {
            var appt = await _appointmentRepository.GetAppointmentByIdAsync(appointmentId);
            if (appt == null) return false;

            await EnsureSlotIsOpenAsync(appt.DoctorId, dto.NewDate, dto.NewTime, appointmentId);

            return await _appointmentRepository.RescheduleAppointmentAsync(
                appointmentId,
                dto.NewDate,
                dto.NewTime,
                dto.Reason
            );
        }

        private async Task EnsureSlotIsOpenAsync(int doctorId, DateTime date, string appointmentTime, int? excludeAppointmentId = null)
        {
            if (string.IsNullOrWhiteSpace(appointmentTime))
            {
                throw new InvalidOperationException("Please select an open consultation time slot.");
            }

            if (date.Date < DateTime.Today)
            {
                throw new InvalidOperationException("Appointments can only be placed for today or upcoming dates.");
            }

            var (start, end) = AppointmentRepository.ParseTimeInterval(appointmentTime);
            var withinMorning = start >= 540 && end <= 780;
            var withinAfternoon = start >= 840 && end <= 1020;
            if (start >= end || (!withinMorning && !withinAfternoon))
            {
                throw new InvalidOperationException($"The time slot '{appointmentTime}' is outside open clinic hours (09:00 AM - 01:00 PM or 02:00 PM - 05:00 PM).");
            }

            var activeLeave = await _appointmentRepository.GetActiveDoctorLeaveForDateAsync(doctorId, date);
            var leaveReason = GetLeaveBlockReason(activeLeave, appointmentTime);
            if (!string.IsNullOrEmpty(leaveReason))
            {
                throw new InvalidOperationException(leaveReason);
            }

            var isBooked = await _appointmentRepository.IsSlotBookedAsync(doctorId, date, appointmentTime, excludeAppointmentId);
            if (isBooked)
            {
                throw new InvalidOperationException($"The time slot '{appointmentTime}' is already booked for Dr. #{doctorId} on {date:yyyy-MM-dd}. Please choose an open slot.");
            }
        }

        private static string? GetLeaveBlockReason(DoctorLeave_Raj? activeLeave, string slotLabel)
        {
            if (activeLeave == null) return null;

            if (activeLeave.LeaveCategory == "future")
            {
                return $"Doctor on Full-Day Leave ({activeLeave.LeaveType}): {activeLeave.Reason}";
            }

            if (activeLeave.LeaveCategory == "half-day")
            {
                if (activeLeave.HalfDaySession == "Morning" && (slotLabel.Contains("AM") || slotLabel.StartsWith("12:")))
                {
                    return $"Doctor on Morning Half-Day Leave: {activeLeave.Reason}";
                }
                if (activeLeave.HalfDaySession == "Afternoon" && slotLabel.Contains("PM") && !slotLabel.StartsWith("12:"))
                {
                    return $"Doctor on Afternoon Half-Day Leave: {activeLeave.Reason}";
                }
            }
            else if (activeLeave.LeaveCategory == "short" && !string.IsNullOrEmpty(activeLeave.StartTime) && !string.IsNullOrEmpty(activeLeave.EndTime))
            {
                var leaveInterval = $"{activeLeave.StartTime} - {activeLeave.EndTime}";
                if (AppointmentRepository.AreSlotsConflicting(leaveInterval, slotLabel))
                {
                    return $"Doctor on Short Leave: {activeLeave.Reason}";
                }
            }

            return null;
        }

        public async Task<bool> IsSlotBookedAsync(int doctorId, DateTime date, string time, int? excludeAppointmentId = null)
        {
            return await _appointmentRepository.IsSlotBookedAsync(doctorId, date, time, excludeAppointmentId);
        }

        public async Task<DoctorScheduleDto> GetDoctorScheduleAsync(int doctorId, DateTime date, int durationMinutes = 60)
        {
            var docUser = await _authServiceClient.GetUserByIdAsync(doctorId);
            var docName = docUser?.FullName ?? $"Doctor #{doctorId}";

            var appts = await _appointmentRepository.GetAppointmentsForDoctorAndDateAsync(doctorId, date);
            var activeLeave = await _appointmentRepository.GetActiveDoctorLeaveForDateAsync(doctorId, date);

            DoctorLeaveDto? currentLeaveDto = null;
            if (activeLeave != null)
            {
                currentLeaveDto = new DoctorLeaveDto
                {
                    LeaveId = activeLeave.LeaveId,
                    DoctorId = activeLeave.DoctorId,
                    DoctorName = activeLeave.DoctorName ?? docName,
                    LeaveCategory = activeLeave.LeaveCategory,
                    LeaveType = activeLeave.LeaveType,
                    StartDate = activeLeave.StartDate.ToString("yyyy-MM-dd"),
                    EndDate = activeLeave.EndDate.ToString("yyyy-MM-dd"),
                    HalfDaySession = activeLeave.HalfDaySession,
                    StartTime = activeLeave.StartTime,
                    EndTime = activeLeave.EndTime,
                    Reason = activeLeave.Reason,
                    Status = activeLeave.Status,
                    CreatedAt = activeLeave.CreatedAt
                };
            }

            var standardSlots = GenerateSlotsForDuration(durationMinutes);

            var slotsResult = new List<DoctorSlotDto>();

            foreach (var slot in standardSlots)
            {
                // Check if slot is blocked by doctor leave
                var leaveNote = GetLeaveBlockReason(activeLeave, slot.Label);
                bool isBlockedByLeave = !string.IsNullOrEmpty(leaveNote);

                var matchingAppt = appts.FirstOrDefault(a => 
                    AppointmentRepository.AreSlotsConflicting(a.AppointmentTime, slot.Label));

                if (isBlockedByLeave)
                {
                    slotsResult.Add(new DoctorSlotDto
                    {
                        SlotLabel = slot.Label,
                        StartTime = slot.Start,
                        EndTime = slot.End,
                        IsBooked = true,
                        Status = "DoctorOnLeave",
                        Notes = leaveNote
                    });
                }
                else if (matchingAppt != null)
                {
                    var pName = matchingAppt.Patient != null 
                        ? $"{matchingAppt.Patient.Prefix} {matchingAppt.Patient.FirstName} {matchingAppt.Patient.LastName}".Trim() 
                        : $"Patient #{matchingAppt.PatientId}";

                    slotsResult.Add(new DoctorSlotDto
                    {
                        SlotLabel = slot.Label,
                        StartTime = slot.Start,
                        EndTime = slot.End,
                        IsBooked = true,
                        AppointmentId = matchingAppt.AppointmentId,
                        PatientId = matchingAppt.PatientId,
                        PatientName = pName,
                        PatientPhone = matchingAppt.Patient?.PhoneNumber,
                        Reason = matchingAppt.Reason,
                        Status = matchingAppt.Status,
                        Notes = matchingAppt.Notes
                    });
                }
                else
                {
                    slotsResult.Add(new DoctorSlotDto
                    {
                        SlotLabel = slot.Label,
                        StartTime = slot.Start,
                        EndTime = slot.End,
                        IsBooked = false,
                        Status = "Available"
                    });
                }
            }

            return new DoctorScheduleDto
            {
                DoctorId = doctorId,
                DoctorName = docName,
                Date = date.Date,
                TotalSlots = slotsResult.Count,
                CurrentLeave = currentLeaveDto,
                BookedSlots = slotsResult.Count(s => s.IsBooked),
                AvailableSlots = slotsResult.Count(s => !s.IsBooked),
                Slots = slotsResult
            };
        }

        private static List<(string Label, string Start, string End)> GenerateSlotsForDuration(int step)
        {
            if (step != 15 && step != 30 && step != 60)
                step = 30;

            var list = new List<(string Label, string Start, string End)>();

            // Working hours: Morning (09:00 AM - 01:00 PM) and Afternoon (02:00 PM - 05:00 PM)
            var periods = new (int Start, int End)[]
            {
                (540, 780),  // 09:00 AM - 01:00 PM
                (840, 1020)  // 02:00 PM - 05:00 PM
            };

            foreach (var (pStart, pEnd) in periods)
            {
                for (int m = pStart; m + step <= pEnd; m += step)
                {
                    var sTime = MinutesToTimeString(m);
                    var eTime = MinutesToTimeString(m + step);
                    list.Add(($"{sTime} - {eTime}", sTime, eTime));
                }
            }

            return list;
        }

        private static string MinutesToTimeString(int minutes)
        {
            int h = (minutes / 60) % 24;
            int m = minutes % 60;
            string ampm = h >= 12 ? "PM" : "AM";
            int displayH = h % 12;
            if (displayH == 0) displayH = 12;
            return $"{displayH:D2}:{m:D2} {ampm}";
        }

        public async Task<List<DoctorLeaveDto>> GetDoctorLeavesAsync(int? doctorId)
        {
            var leaves = await _appointmentRepository.GetDoctorLeavesAsync(doctorId);
            return leaves.Select(l => new DoctorLeaveDto
            {
                LeaveId = l.LeaveId,
                DoctorId = l.DoctorId,
                DoctorName = l.DoctorName,
                LeaveCategory = l.LeaveCategory,
                LeaveType = l.LeaveType,
                StartDate = l.StartDate.ToString("yyyy-MM-dd"),
                EndDate = l.EndDate.ToString("yyyy-MM-dd"),
                HalfDaySession = l.HalfDaySession,
                StartTime = l.StartTime,
                EndTime = l.EndTime,
                Reason = l.Reason,
                Status = l.Status,
                CreatedAt = l.CreatedAt
            }).ToList();
        }

        public async Task<DoctorLeaveDto?> GetActiveDoctorLeaveForDateAsync(int doctorId, DateTime date)
        {
            var l = await _appointmentRepository.GetActiveDoctorLeaveForDateAsync(doctorId, date);
            if (l == null) return null;

            return new DoctorLeaveDto
            {
                LeaveId = l.LeaveId,
                DoctorId = l.DoctorId,
                DoctorName = l.DoctorName,
                LeaveCategory = l.LeaveCategory,
                LeaveType = l.LeaveType,
                StartDate = l.StartDate.ToString("yyyy-MM-dd"),
                EndDate = l.EndDate.ToString("yyyy-MM-dd"),
                HalfDaySession = l.HalfDaySession,
                StartTime = l.StartTime,
                EndTime = l.EndTime,
                Reason = l.Reason,
                Status = l.Status,
                CreatedAt = l.CreatedAt
            };
        }

        public async Task<DoctorLeaveDto> CreateDoctorLeaveAsync(CreateDoctorLeaveDto dto)
        {
            string? docName = dto.DoctorName;
            if (string.IsNullOrWhiteSpace(docName))
            {
                var docUser = await _authServiceClient.GetUserByIdAsync(dto.DoctorId);
                docName = docUser?.FullName ?? $"Doctor #{dto.DoctorId}";
            }

            var entity = new DoctorLeave_Raj
            {
                DoctorId = dto.DoctorId,
                DoctorName = docName,
                LeaveCategory = dto.LeaveCategory,
                LeaveType = dto.LeaveType,
                StartDate = dto.StartDate.Date,
                EndDate = dto.EndDate.Date,
                HalfDaySession = dto.HalfDaySession,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime,
                Reason = dto.Reason,
                Status = "Approved",
                CreatedAt = DateTime.UtcNow
            };

            var created = await _appointmentRepository.CreateDoctorLeaveAsync(entity);

            return new DoctorLeaveDto
            {
                LeaveId = created.LeaveId,
                DoctorId = created.DoctorId,
                DoctorName = created.DoctorName,
                LeaveCategory = created.LeaveCategory,
                LeaveType = created.LeaveType,
                StartDate = created.StartDate.ToString("yyyy-MM-dd"),
                EndDate = created.EndDate.ToString("yyyy-MM-dd"),
                HalfDaySession = created.HalfDaySession,
                StartTime = created.StartTime,
                EndTime = created.EndTime,
                Reason = created.Reason,
                Status = created.Status,
                CreatedAt = created.CreatedAt
            };
        }

        public async Task<bool> CancelDoctorLeaveAsync(int leaveId)
        {
            return await _appointmentRepository.CancelDoctorLeaveAsync(leaveId);
        }
    }
}
