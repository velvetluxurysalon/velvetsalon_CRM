export interface AttendanceQueryDto {
  from?: string;   // YYYY-MM-DD
  to?:   string;   // YYYY-MM-DD
}

export interface UpsertAttendanceDto {
  staffId:   string;
  date:      string;
  status:    'present' | 'absent' | 'half-day' | 'late' | 'holiday';
  checkIn?:  string;
  checkOut?: string;
  notes?:    string;
}

export function validateUpsertAttendanceDto(body: Partial<UpsertAttendanceDto>): string[] {
  const errors: string[] = [];
  if (!body.staffId?.trim())                                        errors.push('staffId is required');
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))       errors.push('date must be YYYY-MM-DD');
  if (!body.status || !['present','absent','half-day','late','holiday'].includes(body.status))
                                                                    errors.push('invalid status');
  return errors;
}