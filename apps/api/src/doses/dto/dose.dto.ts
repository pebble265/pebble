import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const USER_CONFIRM_METHODS = ['app', 'robot_button', 'robot_sensor'] as const;
export type UserConfirmMethod = (typeof USER_CONFIRM_METHODS)[number];

export class DoseActionDto {
  /** How the dose was confirmed. Defaults to "app". */
  @IsOptional()
  @IsIn(USER_CONFIRM_METHODS)
  via?: UserConfirmMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
