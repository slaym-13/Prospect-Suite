import { DrawerSection } from '../../components/ui/Drawer';
import { Field, Input } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { addDays, shortDate } from '../../lib/format';

/** The follow-up date that puts a company back on the Today page. */
export function PipelinePanel({ lead, onPatch }) {
  return (
    <DrawerSection title="Next step">
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        <Field label="Follow up on">
          <Input type="date" value={lead.nextStep || ''} onChange={(e) => onPatch({ nextStep: e.target.value })} />
        </Field>
        <div className="flex flex-wrap items-end gap-1.5">
          <Button size="sm" onClick={() => onPatch({ nextStep: addDays(3) }, 'Follow-up in 3 days')}>
            In 3 days
          </Button>
          <Button size="sm" onClick={() => onPatch({ nextStep: addDays(7) }, 'Follow-up in a week')}>
            In a week
          </Button>
          {lead.nextStep && (
            <Button size="sm" variant="ghost" onClick={() => onPatch({ nextStep: '' }, 'Follow-up cleared')}>
              Clear
            </Button>
          )}
        </div>
      </div>
      {lead.snooze && <p className="text-[12.5px] text-muted">Hidden from Today until {shortDate(lead.snooze)}.</p>}
    </DrawerSection>
  );
}
