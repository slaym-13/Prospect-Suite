import { useApp } from '../../store/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const JOB_NAME = { places: 'Google Places lookup' };

/** Progress of the running Google Places job. Hidden when nothing is running. */
export function JobBar() {
  const { job, cancelJob, dismissJob } = useApp();
  if (!job?.id) return null;

  const percent = job.total ? Math.round((100 * job.done) / job.total) : 100;
  const detail = [
    `${job.done} / ${job.total}`,
    `${job.found} found`,
    job.failed ? `${job.failed} errors` : null,
    job.message
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <strong className="text-sm">{job.running ? 'Running…' : 'Finished'}</strong>
        <span className="flex-1 text-[13px] text-muted">
          {JOB_NAME[job.type] || job.type}: {detail}
        </span>
        {job.running ? (
          <Button size="sm" onClick={cancelJob}>
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={dismissJob}>
            Dismiss
          </Button>
        )}
      </div>
      <div
        className="h-[7px] overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </Card>
  );
}
