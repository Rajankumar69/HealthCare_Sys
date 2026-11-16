using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HealthcareService.Models
{
    [Table("DoctorLeaves_Raj")]
    public class DoctorLeave_Raj
    {
        [Key]
        public int LeaveId { get; set; }

        [Required]
        public int DoctorId { get; set; }

        [MaxLength(250)]
        public string? DoctorName { get; set; }

        [Required]
        [MaxLength(50)]
        public string LeaveCategory { get; set; } = "future"; // future, half-day, short

        [Required]
        [MaxLength(100)]
        public string LeaveType { get; set; } = "Annual Leave";

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        [MaxLength(50)]
        public string? HalfDaySession { get; set; } // Morning, Afternoon

        [MaxLength(20)]
        public string? StartTime { get; set; }

        [MaxLength(20)]
        public string? EndTime { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Approved"; // Approved, Cancelled

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
