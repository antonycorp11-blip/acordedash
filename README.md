# Bunker do Loop

Jogo de construção e gerenciamento de bunker para navegador. Um viajante do
tempo preso num loop precisa cavar um bunker, sobreviver à explosão que acaba
com o mundo e aguentar mais 30 (depois 60, depois 90) dias lá embaixo.

- TypeScript + Vite + Phaser 3. Sem React, sem arquivos de arte ou som:
  todos os sprites, ícones, animações e sons são gerados por código.
- Pensado para celular na horizontal; funciona no desktop (mouse, roda, botão direito para arrastar).
- Roda offline depois de carregado (as fontes do Google têm fallback para fonte do sistema).

## Comandos

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # checagem de tipos + build de produção em dist/
npm test           # testes da simulação, textos e saves
npm run batch -- 90  # simulação em lote (90 runs) com relatório
```

## Estrutura

```
src/
  core/      simulação pura (sem Phaser, sem DOM): RNG, estado, balanceamento,
             grade, salas, sistemas (energia, ar, comida, estrutura, moral, clima),
             explosão, emergências, catástrofes, sobreviventes, motim, habilidades,
             progressão, finais, legista, tick/fechamento diário, comandos, lote
  view/      Phaser: cenas, visão do bunker, arte gerada, HUD, áudio, store
  infra/     SaveAdapter (localStorage), configurações, orientação
  strings/   pt-BR.ts — todo texto visível
  tests/     vitest
scripts/batch.ts
```

A apresentação nunca altera o estado: toda mudança é um `Command` aplicado
por `applyCommand` (puro). O relógio chama `tick` (puro) do núcleo.
Todos os números de regra estão em `src/core/balance.ts`.

## Modo desenvolvedor

Toque cinco vezes rápido no logo do título, ou no relógio do HUD durante o jogo.
Mostra valores ocultos, log, salas, pessoas, ações de teste (pular dias, forçar
catástrofe/motim/emergência, recursos, teleporte, semente) e a simulação em lote.

## Persistência

Todo acesso a progresso passa por `SaveAdapter` (`load/save/clear`) em
`src/infra/saveAdapter.ts`. Para trocar a forma de salvar, basta outra
implementação passada ao `Store` em `src/view/store.ts`.

Veja `DECISIONS.md` para as decisões de design tomadas.
