import { BadRequestException, Injectable } from '@nestjs/common';
import { stringToTimeColumn, timeColumnToString } from '../common/time';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRobotSettingsDto } from './dto/robot-settings.dto';

@Injectable()
export class RobotSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    // Every user gets a row at register; upsert covers older accounts.
    const s = await this.prisma.robot_settings.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
    });
    return this.toResponse(s);
  }

  async update(userId: string, dto: UpdateRobotSettingsDto) {
    const current = await this.get(userId);

    const start =
      dto.quietHoursStart !== undefined ? dto.quietHoursStart : current.quietHoursStart;
    const end =
      dto.quietHoursEnd !== undefined ? dto.quietHoursEnd : current.quietHoursEnd;
    if ((start === null) !== (end === null)) {
      throw new BadRequestException(
        'quietHoursStart and quietHoursEnd must both be set or both be null',
      );
    }

    const s = await this.prisma.robot_settings.update({
      where: { user_id: userId },
      data: {
        ...(dto.robotName !== undefined && { robot_name: dto.robotName.trim() }),
        ...(dto.voiceId !== undefined && { voice_id: dto.voiceId }),
        ...(dto.speechRate !== undefined && { speech_rate: dto.speechRate }),
        ...(dto.greetingText !== undefined && {
          greeting_text: dto.greetingText.trim(),
        }),
        ...(dto.wakeWord !== undefined && { wake_word: dto.wakeWord.trim() }),
        ...(dto.faceTheme !== undefined && { face_theme: dto.faceTheme }),
        quiet_hours_start: start ? stringToTimeColumn(start) : null,
        quiet_hours_end: end ? stringToTimeColumn(end) : null,
      },
    });
    return this.toResponse(s);
  }

  private toResponse(s: {
    robot_name: string;
    voice_id: string;
    speech_rate: unknown;
    greeting_text: string;
    wake_word: string;
    face_theme: string;
    quiet_hours_start: Date | null;
    quiet_hours_end: Date | null;
    updated_at: Date;
  }) {
    return {
      robotName: s.robot_name,
      voiceId: s.voice_id,
      speechRate: Number(s.speech_rate),
      greetingText: s.greeting_text,
      wakeWord: s.wake_word,
      faceTheme: s.face_theme,
      quietHoursStart: s.quiet_hours_start
        ? timeColumnToString(s.quiet_hours_start)
        : null,
      quietHoursEnd: s.quiet_hours_end
        ? timeColumnToString(s.quiet_hours_end)
        : null,
      updatedAt: s.updated_at,
    };
  }
}
