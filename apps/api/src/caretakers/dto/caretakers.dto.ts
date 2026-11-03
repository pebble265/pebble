import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** What a caretaker may see / be alerted about. Every flag is the user's choice. */
export class PermissionsDto {
  @IsOptional() @IsBoolean() alertOnCrisis?: boolean;
  @IsOptional() @IsBoolean() alertOnMissedDose?: boolean;
  /** Robot offline, low battery, dispenser jam */
  @IsOptional() @IsBoolean() alertOnDeviceIssue?: boolean;
  @IsOptional() @IsBoolean() viewAdherence?: boolean;
  @IsOptional() @IsBoolean() viewMoodTrend?: boolean;
  @IsOptional() @IsBoolean() viewConversationSummaries?: boolean;
}

export class CreateInviteDto {
  /** If set, only an account with this email can accept. */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** "แม่", "พี่สาว", "คุณหมอ" */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  relationshipLabel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PermissionsDto)
  permissions?: PermissionsDto;
}

export class InviteTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}
