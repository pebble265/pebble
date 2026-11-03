import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ScheduleDto } from './schedule.dto';

/** Every field optional. Sending `schedules` replaces all schedules. */
export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dispenserSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pillsRemaining?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];
}
