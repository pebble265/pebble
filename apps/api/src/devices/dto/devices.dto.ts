import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** App -> backend: pair the robot showing this code. */
export class PairDeviceDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;

  /** Serial the robot reported over Bluetooth; the code must belong to it. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  serialNumber?: string;
}

/** What the app can ask the robot to do from the "pebble" tab. */
/**
 * wake: say hello + listen · forward/backward/left/right: move until "stop" (sent on release)
 * wave: wave the arm · box: open/close the pill box
 */
export const ROBOT_ACTIONS = ['wake', 'forward', 'backward', 'left', 'right', 'stop', 'wave', 'box', 'test'] as const;
export type RobotAction = (typeof ROBOT_ACTIONS)[number];

/** App -> backend -> robot: a remote-control command. */
export class RobotCommandDto {
  @IsIn(ROBOT_ACTIONS)
  action!: RobotAction;

  /** action "test" only: one ESP32 command, e.g. {"cmd":"servo","ch":5,"angle":100} (the robot checks it) */
  @IsOptional()
  @IsObject()
  esp?: Record<string, unknown>;
}

/** Robot -> backend while the app's hardware test screen is open: how the ESP32 link looks. */
export class RobotTestReportDto {
  @IsBoolean()
  espLinked!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  espFw?: string;

  /** "uart" / "usb" / "" */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  espPort?: string;

  /** seconds since the last line from the ESP32 */
  @IsOptional()
  @IsInt()
  espAgo?: number;

  /** latest ESP32 event lines, newest last */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  events?: string[];
}

/** Robot -> backend: log in with the credentials burned in at the factory. */
export class RobotAuthDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  serialNumber!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(200)
  secret!: string;
}

export const ROBOT_REPORTED_STATUS = ['online', 'charging', 'error'] as const;

/** Robot -> backend every minute or so. */
export class HeartbeatDto {
  /** Left out while the robot can't read its battery (ESP32 not linked yet). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @IsOptional()
  @IsIn(ROBOT_REPORTED_STATUS)
  status?: (typeof ROBOT_REPORTED_STATUS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  firmwareVersion?: string;
}

export class RobotDoseTakeDto {
  @IsIn(['robot_button', 'robot_sensor'])
  via!: 'robot_button' | 'robot_sensor';
}
