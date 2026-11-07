import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { safeUrl } from '../../lib/format';

/**
 * Call, WhatsApp, Email, Maps, Site. Each only appears when it can actually work:
 * WhatsApp needs a Moroccan mobile, Site needs a website. Email is the exception —
 * when there is no address we say so, rather than leaving a gap that reads as a bug.
 */
export function ContactActions({ lead, scored, size = 'sm' }) {
  const phone = scored.phone;
  const maps = safeUrl(lead.google_maps);
  const site = safeUrl(lead.site_web);
  const email = lead.email;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {phone.tel && (
        <Button size={size} href={`tel:${phone.tel}`}>
          Call
        </Button>
      )}
      {phone.wa && (
        <Button size={size} href={`https://wa.me/${phone.wa}`} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </Button>
      )}
      {email ? (
        <Button size={size} href={`mailto:${email}`} title={email}>
          Email
        </Button>
      ) : (
        <Pill tone="warn">No email</Pill>
      )}
      {maps && (
        <Button size={size} href={maps} target="_blank" rel="noopener noreferrer">
          Maps
        </Button>
      )}
      {site && (
        <Button size={size} href={site} target="_blank" rel="noopener noreferrer">
          Site
        </Button>
      )}
    </div>
  );
}
