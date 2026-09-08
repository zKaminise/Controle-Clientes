import { describe, expect, it } from 'vitest';
import {
  calculateLeadScore,
  leadScoreLevel,
  normalizeDomainIdentity,
  normalizeEmailIdentity,
  normalizeNameCityIdentity,
  normalizePhoneIdentity,
} from '@/lib/crm';

describe('lead score', () => {
  it('scores a digitally active company without a site and with contact data', () => {
    expect(
      calculateLeadScore(
        { whatsapp: '(11) 99999-0000', email: 'contato@empresa.com.br' },
        {
          hasSite: false,
          siteStatus: 'SEM_SITE',
          hasActiveDigitalPresence: true,
        },
      ),
    ).toMatchObject({ score: 65, level: 'ALTA' });
  });

  it('clamps the score and classifies all ranges', () => {
    expect(calculateLeadScore({}, { siteStatus: 'SITE_BOM' }).score).toBe(0);
    expect(leadScoreLevel(29)).toBe('BAIXA');
    expect(leadScoreLevel(30)).toBe('MEDIA');
    expect(leadScoreLevel(60)).toBe('ALTA');
    expect(leadScoreLevel(80)).toBe('MUITO_ALTA');
  });

  it('honors configurable rule points and disabled rules', () => {
    const result = calculateLeadScore({ email: 'a@b.com' }, {}, [
      {
        ruleKey: 'public_email',
        label: 'E-mail',
        points: 40,
        enabled: true,
        position: 0,
      },
      {
        ruleKey: 'public_phone',
        label: 'Telefone',
        points: 99,
        enabled: false,
        position: 1,
      },
    ]);
    expect(result).toMatchObject({ score: 40, level: 'MEDIA' });
  });
});

describe('duplicate identities', () => {
  it('normalizes phone, e-mail, domain and name plus city', () => {
    expect(normalizePhoneIdentity('+55 (11) 98765-4321')).toBe('11987654321');
    expect(normalizeEmailIdentity(' Contato@Empresa.COM ')).toBe(
      'contato@empresa.com',
    );
    expect(normalizeDomainIdentity('https://www.Empresa.com.br/pagina')).toBe(
      'empresa.com.br',
    );
    expect(normalizeNameCityIdentity('Clínica São José', 'São Paulo')).toBe(
      'clinica sao jose|sao paulo',
    );
  });
});
