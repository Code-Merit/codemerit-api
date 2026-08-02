import { Controller, Get } from '@nestjs/common';
import * as os from 'os';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/core/auth/decorators/public.decorator';
@ApiTags('Monitoring')
@Public()
@Controller('monitoring')
export class MonitoringController {
  private readonly startTime = Date.now();

  @ApiOperation({
    summary: 'Liveness check (public)',
    description:
      'Always returns `status: ok` with the current server timestamp if the process is up and ' +
      'able to handle requests — no dependency checks (DB, etc.) are performed. Intended for ' +
      'load-balancer/uptime-monitor health probes.',
  })
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @ApiOperation({
    summary: 'Process metrics snapshot (public)',
    description:
      'Returns process uptime in seconds (since this controller instance was created), Node ' +
      'memory usage, OS load averages, and free/total system memory — a lightweight in-process ' +
      'snapshot for ops dashboards, not a time series.',
  })
  @Get('metrics')
  metrics() {
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      uptime_seconds: seconds,
      memoryUsage: process.memoryUsage(),
      cpuLoad: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
    };
  }
}

