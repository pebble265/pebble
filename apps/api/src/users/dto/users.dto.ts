import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SEXES = ['male', 'female', 'other'] as const;
const THIS_YEAR = new Date().getFullYear();

/** Fields from the "Create Account" screen (all optional when editing later). */
class ProfileFields {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  /** How the robot should pronounce the name, e.g. "ชานนท์" */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pronunciation?: string;

  @IsOptional()
  @IsIn(SEXES)
  sex?: (typeof SEXES)[number];

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(THIS_YEAR)
  birthYear?: number;

  /** Phone number, digits with optional + - space ( ); "" clears it */
  @IsOptional()
  @Matches(/^$|^[+]?[0-9 ()-]{6,20}$/, { message: 'phone must be a phone number' })
  phone?: string;
}

export class UpdateProfileDto extends ProfileFields {
  /** IANA timezone, e.g. "Asia/Bangkok" */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  /** e.g. "th-TH", "en-US" */
  @IsOptional()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'locale must look like th-TH' })
  locale?: string;
}

/** The user must accept both before onboarding is complete. */
export class CompleteOnboardingDto extends ProfileFields {
  @Equals(true, { message: 'acceptTerms must be true' })
  acceptTerms!: boolean;

  /** Consent to process health data (medication, mood) — required by PDPA. */
  @Equals(true, { message: 'acceptHealthData must be true' })
  acceptHealthData!: boolean;
}

/** Finished the "connect your pebble(a)" screens without pairing (e.g. no robot yet). */
export class RobotSetupDto {
  @IsBoolean()
  skipped!: boolean;
}

/** Change password while signed in. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class SetAvatarDto {
  /** data:image/jpeg;base64,... — the app sends a ~320px square JPEG */
  @IsString()
  @MaxLength(600_000)
  image!: string;
}
