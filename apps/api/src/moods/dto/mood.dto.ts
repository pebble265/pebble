import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMoodDto {
  /** 1 = very low ... 7 = great (the 7 emoji on the Home screen, left to right) */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  score!: number;

  @IsOptional()
  @IsIn(['app', 'robot'])
  source?: 'app' | 'robot';

  /** Optional short note, e.g. "slept badly" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Add, change or clear ("") the note of a check-in. */
export class UpdateMoodNoteDto {
  @IsString()
  @MaxLength(500)
  note!: string;
}

export class MoodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
