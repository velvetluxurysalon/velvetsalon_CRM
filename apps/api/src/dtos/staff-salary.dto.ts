// ─── Staff DTOs ──────────────────────────────────────────────────────────────

export interface CreateStaffDto {
  name:        string;
  role?:       string;
  initials?:   string;   // auto-generated if omitted
  color?:      string;
  joinDate?:   string;   // defaults to today
  salary?:     number;
  salaryMode?: 'monthly' | 'daily' | 'hourly';
}

export interface UpdateStaffDto {
  name?:           string;
  role?:           string;
  initials?:       string;
  color?:          string;
  joinDate?:       string;
  terminatedDate?: string;
  salary?:         number;
  salaryMode?:     'monthly' | 'daily' | 'hourly';
}

export function validateCreateStaffDto(body: Partial<CreateStaffDto>): string[] {
  const errors: string[] = [];
  if (!body.name?.trim()) errors.push('name is required');
  if (body.salary !== undefined && (isNaN(body.salary) || body.salary < 0))
    errors.push('salary must be a non-negative number');
  if (body.salaryMode && !['monthly', 'daily', 'hourly'].includes(body.salaryMode))
    errors.push('salaryMode must be monthly, daily, or hourly');
  if (body.joinDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.joinDate))
    errors.push('joinDate must be YYYY-MM-DD');
  return errors;
}

export function validateUpdateStaffDto(body: Partial<UpdateStaffDto>): string[] {
  const errors: string[] = [];
  if (body.salary !== undefined && (isNaN(body.salary) || body.salary < 0))
    errors.push('salary must be a non-negative number');
  if (body.salaryMode && !['monthly', 'daily', 'hourly'].includes(body.salaryMode))
    errors.push('salaryMode must be monthly, daily, or hourly');
  if (body.joinDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.joinDate))
    errors.push('joinDate must be YYYY-MM-DD');
  if (body.terminatedDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.terminatedDate))
    errors.push('terminatedDate must be YYYY-MM-DD');
  return errors;
}

// ─── Salary DTOs ─────────────────────────────────────────────────────────────

export interface CreateSalaryCreditDto {
  staffId: string;
  amount:  number;
  date:    string;
  note?:   string;
  period:  string;
}

export function validateCreateSalaryCreditDto(body: Partial<CreateSalaryCreditDto>): string[] {
  const errors: string[] = [];
  if (!body.staffId?.trim())                                    errors.push('staffId is required');
  if (!body.amount || isNaN(body.amount) || body.amount <= 0)  errors.push('amount must be a positive number');
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))   errors.push('date must be YYYY-MM-DD');
  if (!body.period?.trim())                                     errors.push('period is required');
  return errors;
}