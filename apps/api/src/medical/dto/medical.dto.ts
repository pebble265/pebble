import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DoctorDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  /** hospital or clinic */
  @IsOptional() @IsString() @MaxLength(100) place?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

/** PATCH /medical — replaces allergies, conditions and the doctor. */
export class MedicalInfoDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true })
  allergies!: string[];

  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true })
  conditions!: string[];

  @IsOptional() @ValidateNested() @Type(() => DoctorDto)
  doctor?: DoctorDto;
}

export class EmergencyContactDto {
  /** "แม่ · สมศรี" */
  @IsString() @MinLength(1) @MaxLength(100)
  label!: string;

  @IsString() @Matches(/^[0-9+\-\s()]{3,30}$/, { message: 'phone must be a phone number' })
  phone!: string;
}
