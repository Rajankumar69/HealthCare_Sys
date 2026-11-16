using HealthcareService.DTOs;

namespace HealthcareService.Services
{
    public interface IAppointmentService
    {
        Task<List<AppointmentDto>> GetAppointmentsAsync(int? doctorId, int? patientId, string? status);
        Task<AppointmentDto?> GetAppointmentByIdAsync(int appointmentId);
        Task<AppointmentDto> CreateAppointmentAsync(CreateAppointmentDto dto);
        Task<bool> FrontDeskApproveAsync(int appointmentId, string? notes);
        Task<bool> NurseDoneAsync(int appointmentId, string? notes);
        Task<bool> NurseApproveAsync(int appointmentId, string? notes);
        Task<bool> DoctorConfirmAsync(int appointmentId, string? notes);
        Task<bool> CancelAppointmentAsync(int appointmentId, string? notes);
        Task<bool> RescheduleAsync(int appointmentId, RescheduleAppointmentDto dto);
        Task<DoctorScheduleDto> GetDoctorScheduleAsync(int doctorId, DateTime date, int durationMinutes = 60);
        Task<bool> IsSlotBookedAsync(int doctorId, DateTime date, string time, int? excludeAppointmentId = null);

        // Doctor Leaves
        Task<List<DoctorLeaveDto>> GetDoctorLeavesAsync(int? doctorId);
        Task<DoctorLeaveDto?> GetActiveDoctorLeaveForDateAsync(int doctorId, DateTime date);
        Task<DoctorLeaveDto> CreateDoctorLeaveAsync(CreateDoctorLeaveDto dto);
        Task<bool> CancelDoctorLeaveAsync(int leaveId);
    }
}
