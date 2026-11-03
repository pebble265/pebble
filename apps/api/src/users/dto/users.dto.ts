import {
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

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
export class CompleteOnboardingDto {
  @Equals(true, { message: 'acceptTerms must be true' })
  acceptTerms!: boolean;

  /** Consent to process health data (medication, mood) — required by PDPA. */
  @Equals(true, { message: 'acceptHealthData must be true' })
  acceptHealthData!: boolean;
}
