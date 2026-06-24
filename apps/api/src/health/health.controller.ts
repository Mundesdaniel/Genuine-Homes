import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // Open endpoint — the global JwtAuthGuard would otherwise require a token.
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ description: 'Service is up.' })
  check(): { status: string; service: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      service: 'genuine-homes-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
