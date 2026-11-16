using System.ComponentModel.DataAnnotations;

namespace HealthcareService.DTOs
{
    public class DoctorLeaveDto
    {
        public int LeaveId { get; set; }
        public int DoctorId { get; set; }
        public string? DoctorName { get; set; }
        public string LeaveCategory { get; set; } = "future"; // future, half-day, short
        public string LeaveType { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD
        public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD
        public string? HalfDaySession { get; set; }           // Morning, Afternoon
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string Status { get; set; } = "Approved";      // Approved, Cancelled
        public DateTime CreatedAt { get; set; }
    }

    public class CreateDoctorLeaveDto
    {
        [Required]
        public int DoctorId { get; set; }

        public string? DoctorName { get; set; }

        [Required]
        public string LeaveCategory { get; set; } = "future"; // future, half-day, short

        [Required]
        public string LeaveType { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public string? HalfDaySession { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }

        [Required]
        public string Reason { get; set; } = string.Empty;
    }
}
