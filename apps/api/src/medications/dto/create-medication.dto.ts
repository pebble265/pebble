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

export class CreateMedicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  /** e.g. "1 เม็ด 50mg" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosage?: string;

  /** e.g. "หลังอาหาร ดื่มน้ำตามเยอะๆ" */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  /** Robot dispenser slot holding this medication (omit if not in the robot) */
  @IsOptional()
  @IsInt()
  @Min(0)
  dispenserSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pillsRemaining?: number;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules!: ScheduleDto[];
}
