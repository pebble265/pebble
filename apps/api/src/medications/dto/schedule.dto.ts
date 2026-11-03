import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ScheduleDto {
  /** Local time in the user's timezone, 24h: "08:00", "20:30" */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:MM' })
  time!: string;

  /** 1=Mon ... 7=Sun. Omit for every day. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];

  /** "YYYY-MM-DD". Omit to start today. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  /** "YYYY-MM-DD". Omit for no end date. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  /** Minutes after the scheduled time before the dose counts as missed. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(240)
  graceMinutes?: number;
}
