using Microsoft.EntityFrameworkCore;
using HealthcareService.Data;
using HealthcareService.Models;

namespace HealthcareService.Repositories
{
    public class AppointmentRepository : IAppointmentRepository
    {
        private readonly HealthcareDbContext _context;

        public AppointmentRepository(HealthcareDbContext context)
        {
            _context = context;
        }

        public async Task<List<Appointment_Raj>> GetAppointmentsAsync(int? doctorId, int? patientId, string? status)
        {
            var query = _context.Appointments
                .Include(a => a.Patient)
                .AsQueryable();

            if (doctorId.HasValue)
            {
                query = query.Where(a => a.DoctorId == doctorId.Value);
                if (string.IsNullOrWhiteSpace(status))
                {
                    query = query.Where(a => a.Status.ToLower() != "requested");
                }
                else if (status.Trim().ToLower() == "requested")
                {
                    query = query.Where(a => false);
                }
            }

            if (patientId.HasValue)
            {
                query = query.Where(a => a.PatientId == patientId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(a => a.Status.ToLower() == status.Trim().ToLower());
            }

            return await query
                .OrderByDescending(a => a.AppointmentDate)
                .ThenBy(a => a.AppointmentTime)
                .ToListAsync();
        }

        public async Task<Appointment_Raj?> GetAppointmentByIdAsync(int appointmentId)
        {
            return await _context.Appointments
                .Include(a => a.Patient)
                .FirstOrDefaultAsync(a => a.AppointmentId == appointmentId);
        }

        public async Task<Appointment_Raj> CreateAppointmentAsync(Appointment_Raj appointment)
        {
            _context.Appointments.Add(appointment);
            await _context.SaveChangesAsync();
            return appointment;
        }

        public async Task<bool> UpdateStatusAsync(int appointmentId, string status, string? notes)
        {
            var appt = await _context.Appointments.FindAsync(appointmentId);
            if (appt == null) return false;

            appt.Status = status;
            if (!string.IsNullOrWhiteSpace(notes))
            {
                appt.Notes = notes;
            }
            appt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RescheduleAppointmentAsync(int appointmentId, DateTime newDate, string newTime, string? reason)
        {
            var appt = await _context.Appointments.FindAsync(appointmentId);
            if (appt == null) return false;

            appt.AppointmentDate = newDate;
            appt.AppointmentTime = newTime;
            appt.Status = "Rescheduled";
            if (!string.IsNullOrWhiteSpace(reason))
            {
                appt.Notes = $"Rescheduled: {reason}";
            }
            appt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<Appointment_Raj>> GetAppointmentsForDoctorAndDateAsync(int doctorId, DateTime date)
        {
            var targetDate = date.Date;
            return await _context.Appointments
                .Include(a => a.Patient)
                .Where(a => a.DoctorId == doctorId && a.AppointmentDate.Date == targetDate && a.Status.ToLower() != "cancelled")
                .ToListAsync();
        }

        public async Task<bool> IsSlotBookedAsync(int doctorId, DateTime date, string time, int? excludeAppointmentId = null)
        {
            var targetDate = date.Date;
            var appts = await _context.Appointments
                .Where(a => a.DoctorId == doctorId 
                            && a.AppointmentDate.Date == targetDate 
                            && a.Status.ToLower() != "cancelled"
                            && (excludeAppointmentId == null || a.AppointmentId != excludeAppointmentId.Value))
                .ToListAsync();

            return appts.Any(a => AreSlotsConflicting(a.AppointmentTime, time));
        }

        public static bool AreSlotsConflicting(string existingTime, string newTime)
        {
            if (string.IsNullOrWhiteSpace(existingTime) || string.IsNullOrWhiteSpace(newTime))
                return false;

            var (s1, e1) = ParseTimeInterval(existingTime);
            var (s2, e2) = ParseTimeInterval(newTime);
            return s1 < e2 && s2 < e1;
        }

        public static (int Start, int End) ParseTimeInterval(string timeStr)
        {
            if (string.IsNullOrWhiteSpace(timeStr))
                return (540, 600);

            var parts = timeStr.Split('-', StringSplitOptions.TrimEntries);
            if (parts.Length >= 2)
            {
                int s = ParseTimeToMinutes(parts[0]);
                int e = ParseTimeToMinutes(parts[1]);
                if (e <= s) e = s + 30;
                return (s, e);
            }
            else
            {
                int s = ParseTimeToMinutes(parts[0]);
                return (s, s + 30);
            }
        }

        public static int ParseTimeToMinutes(string str)
        {
            if (string.IsNullOrWhiteSpace(str)) return 540;

            if (DateTime.TryParse(str.Trim(), out var dt))
            {
                return dt.Hour * 60 + dt.Minute;
            }

            var upper = str.Trim().ToUpper();
            bool isPm = upper.Contains("PM");
            bool isAm = upper.Contains("AM");
            var clean = upper.Replace("AM", "").Replace("PM", "").Trim();
            var colon = clean.Split(':');
            if (colon.Length >= 2 && int.TryParse(colon[0], out var h) && int.TryParse(colon[1], out var m))
            {
                if (isPm && h < 12) h += 12;
                if (isAm && h == 12) h = 0;
                return h * 60 + m;
            }
            return 540;
        }

        public async Task<List<DoctorLeave_Raj>> GetDoctorLeavesAsync(int? doctorId)
        {
            var query = _context.DoctorLeaves.AsNoTracking().Where(l => l.Status != "Cancelled");
            if (doctorId.HasValue && doctorId.Value > 0)
            {
                query = query.Where(l => l.DoctorId == doctorId.Value);
            }
            return await query.OrderByDescending(l => l.CreatedAt).ToListAsync();
        }

        public async Task<DoctorLeave_Raj?> GetActiveDoctorLeaveForDateAsync(int doctorId, DateTime date)
        {
            var target = date.Date;
            return await _context.DoctorLeaves
                .AsNoTracking()
                .Where(l => l.DoctorId == doctorId && l.Status != "Cancelled" && l.StartDate <= target && l.EndDate >= target)
                .OrderByDescending(l => l.LeaveId)
                .FirstOrDefaultAsync();
        }

        public async Task<DoctorLeave_Raj> CreateDoctorLeaveAsync(DoctorLeave_Raj leave)
        {
            leave.CreatedAt = DateTime.UtcNow;
            leave.Status = "Approved";
            _context.DoctorLeaves.Add(leave);
            await _context.SaveChangesAsync();
            return leave;
        }

        public async Task<bool> CancelDoctorLeaveAsync(int leaveId)
        {
            var leave = await _context.DoctorLeaves.FindAsync(leaveId);
            if (leave == null) return false;
            leave.Status = "Cancelled";
            leave.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
