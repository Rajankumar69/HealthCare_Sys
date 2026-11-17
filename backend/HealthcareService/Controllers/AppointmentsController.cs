using Microsoft.AspNetCore.Mvc;
using HealthcareService.DTOs;
using HealthcareService.Services;

namespace HealthcareService.Controllers
{
    public class AppointmentApprovalDto
    {
        public string? Notes { get; set; }
    }

    [ApiController]
    [Route("api/healthcare/[controller]")]
    public class AppointmentsController : ControllerBase
    {
        private readonly IAppointmentService _appointmentService;

        public AppointmentsController(IAppointmentService appointmentService)
        {
            _appointmentService = appointmentService;
        }

        private string? GetCallerRole()
        {
            return Request.Headers["X-User-Role"].FirstOrDefault()
                   ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
                   ?? User.FindFirst("role")?.Value;
        }

        [HttpGet]
        public async Task<IActionResult> GetAppointments(
            [FromQuery] int? doctorId,
            [FromQuery] int? patientId,
            [FromQuery] string? status)
        {
            var appointments = await _appointmentService.GetAppointmentsAsync(doctorId, patientId, status);
            return Ok(appointments);
        }

        [HttpGet("doctor-schedule")]
        public async Task<IActionResult> GetDoctorSchedule(
            [FromQuery] int doctorId, 
            [FromQuery] DateTime? date,
            [FromQuery] int? durationMinutes)
        {
            var targetDate = date ?? DateTime.Today;
            var duration = durationMinutes ?? 60;
            var schedule = await _appointmentService.GetDoctorScheduleAsync(doctorId, targetDate, duration);
            return Ok(schedule);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetAppointmentById(int id)
        {
            var appointment = await _appointmentService.GetAppointmentByIdAsync(id);
            if (appointment == null)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(appointment);
        }

        [HttpPost]
        public async Task<IActionResult> CreateAppointment([FromBody] CreateAppointmentDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var created = await _appointmentService.CreateAppointmentAsync(dto);
                return CreatedAtAction(nameof(GetAppointmentById), new { id = created.AppointmentId }, created);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // Exclusive Front Desk approval: Transitions appointment to "Approved"
        // Requirement: "Front Desk role ho jiske pass apoointments approve karne ki authority ho, and vo authrity kisi or ke pass na ho"
        [HttpPut("{id}/approve")]
        public async Task<IActionResult> FrontDeskApprove(int id, [FromBody] AppointmentApprovalDto? dto)
        {
            var role = GetCallerRole();
            if (!string.Equals(role, "FrontDesk", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Authority Denied: Only Front Desk staff has the authority to approve appointments." });
            }

            var success = await _appointmentService.FrontDeskApproveAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(new { message = "Appointment approved by Front Desk." });
        }

        // Nurse sets appointment status to "Done"
        // Requirement: "nurses ke pass authority ho vo appointments ko done status de sake or reschedule kar sake"
        [HttpPut("{id}/done")]
        public async Task<IActionResult> MarkAsDone(int id, [FromBody] AppointmentApprovalDto? dto)
        {
            var role = GetCallerRole();
            if (!string.Equals(role, "Nurse", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Authority Denied: Only Nurses have the authority to mark appointments as Done." });
            }

            var success = await _appointmentService.NurseDoneAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(new { message = "Appointment marked as Done by Nurse." });
        }

        // Legacy nurse approval redirected/restricted per requirement
        [HttpPut("{id}/nurse-approve")]
        public async Task<IActionResult> NurseApprove(int id, [FromBody] AppointmentApprovalDto? dto)
        {
            var role = GetCallerRole();
            if (!string.Equals(role, "FrontDesk", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Appointment approval authority belongs exclusively to the Front Desk role. Nurses are not authorized to approve appointments." });
            }

            var success = await _appointmentService.FrontDeskApproveAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(new { message = "Appointment approved by Front Desk." });
        }

        // Doctor confirmation restricted per requirement
        [HttpPut("{id}/doctor-confirm")]
        public async Task<IActionResult> DoctorConfirm(int id, [FromBody] AppointmentApprovalDto? dto)
        {
            var role = GetCallerRole();
            if (!string.Equals(role, "FrontDesk", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Appointment approval authority belongs exclusively to the Front Desk." });
            }

            var success = await _appointmentService.FrontDeskApproveAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(new { message = "Appointment confirmed." });
        }

        // Cancel appointment
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelAppointment(int id, [FromBody] AppointmentApprovalDto? dto)
        {
            var success = await _appointmentService.CancelAppointmentAsync(id, dto?.Notes);
            if (!success)
            {
                return NotFound(new { message = "Appointment not found." });
            }
            return Ok(new { message = "Appointment cancelled." });
        }

        // Reschedule appointment (Exclusively authorized for Nurses and Front Desk staff; Doctors are read-only)
        // Requirement: "appointmen reschedule karne ki authority sirf front desk and nurses ke pass honi chaiye doctors bas view kar sakta he."
        [HttpPut("{id}/reschedule")]
        public async Task<IActionResult> Reschedule(int id, [FromBody] RescheduleAppointmentDto dto)
        {
            var role = GetCallerRole();
            if (!string.Equals(role, "FrontDesk", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(role, "Nurse", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = "Authority Denied: Only Front Desk staff and Nurses have the authority to reschedule appointments. Doctors can only view appointments." 
                });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var success = await _appointmentService.RescheduleAsync(id, dto);
                if (!success)
                {
                    return NotFound(new { message = "Appointment not found." });
                }
                return Ok(new { message = "Appointment rescheduled successfully." });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("doctor-leaves")]
        public async Task<IActionResult> GetDoctorLeaves([FromQuery] int? doctorId)
        {
            var leaves = await _appointmentService.GetDoctorLeavesAsync(doctorId);
            return Ok(leaves);
        }

        [HttpPost("doctor-leaves")]
        public async Task<IActionResult> CreateDoctorLeave([FromBody] CreateDoctorLeaveDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            var created = await _appointmentService.CreateDoctorLeaveAsync(dto);
            return Ok(created);
        }

        [HttpPut("doctor-leaves/{leaveId}/cancel")]
        public async Task<IActionResult> CancelDoctorLeave(int leaveId)
        {
            var success = await _appointmentService.CancelDoctorLeaveAsync(leaveId);
            if (!success)
            {
                return NotFound(new { message = "Doctor leave record not found." });
            }
            return Ok(new { message = "Doctor leave cancelled successfully." });
        }
    }
}
