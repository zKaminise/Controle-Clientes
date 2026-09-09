# Baseline da revisão funcional do CRM

Registro feito em 09/09/2026 antes da normalização dos clientes existentes.

## Registros preservados

- 5 empresas principais, todas já com `lifecycleStatus = client`.
- 5 projetos vinculados, todos já com `status = delivered`.
- 1 assinatura ativa de **Manutenção e Hospedagem**, pertencente a Sal e Açúcar, no valor de R$ 50,00/mês.
- 1 cobrança agendada dessa assinatura, no valor de R$ 50,00.
- Nenhum plano e nenhuma cobrança aberta para os outros quatro clientes.

## Inconsistência encontrada

Os cinco clientes estavam com `prospectingStatus = NOVO_LEAD`, embora já fossem clientes e tivessem projeto entregue. Isso fazia com que aparecessem operacionalmente na prospecção.

## Identificação única e plano do dry-run

| ID | Nome anterior | Nome final | Projeto | Recorrência |
| --- | --- | --- | --- | --- |
| `52816827-38fc-40ba-ba50-22ebde2123ef` | Alçar Humà Gestão e Pessoas Ltda | Alçar Rioma Gestão e Pessoas LTDA | já entregue | nenhuma |
| `ef11a344-9280-4281-abdd-c1ce1fdfaece` | Clinica Odontologia FL | Clínica Odontológica FL | já entregue | nenhuma |
| `48fdd768-5fe8-4243-8500-0b95ec207a34` | Saldanha Moveis | Saldanha Móveis | já entregue | nenhuma |
| `52011523-ac82-44c6-81a8-9af8fa6b0e08` | Cliente Lucas Perazoli | Lucas Perazoli | já entregue | nenhuma |
| `eaf3bad9-2097-4a62-be31-beba25b86ba9` | Sal e Açucar Gastronomia | Sal e Açúcar Gastronomia | já entregue | R$ 50,00/mês existente |

O dry-run não encontrou duplicidade, registros arquivados, planos indevidos ou cobranças abertas nos quatro clientes sem manutenção. A transformação prevista altera somente nome canônico, etapa de prospecção para `FECHADO` e reafirma lifecycle/relacionamento/projeto. Contatos, valores, datas, financeiro, análises, interações e histórico não são preenchidos nem removidos.

