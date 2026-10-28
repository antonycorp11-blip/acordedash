# Decisões

Decisões tomadas onde o documento de design deixava espaço, e por quê.

## Padrões da seção 20 (também no topo de `balance.ts`)
- Origem do conhecimento: diário de um eu anterior, encontrado no futuro.
- Pausa durante a simulação: sim. Na pausa dá para consertar, mudar funções e responder emergências, mas não construir salas.
- Velocidade padrão: 1 dia = 60 s em 1x (1 tick = 1 hora = 2,5 s). Velocidades 0/1x/2x/4x.
- Construção: 10 dias. Meta inicial: 30 dias. Idioma: pt-BR.

## Técnica
- Estilo visual: por pedido do dono do projeto, a arte segue referências de cartum 2D em alta definição (contorno escuro, sombreamento, cores quentes) em vez de pixel art de baixa resolução. Tudo continua gerado por código: as texturas são desenhadas vetorialmente em canvas a 4 texels por unidade do mundo e exibidas com filtragem suave.
- Layout pensado em 640×360 (tiles de 16 unidades), canvas 1280×720 com câmera 2×.
- Céu da superfície muda por fase: pôr do sol com ruínas (construção), cogumelo nuclear (contagem), céu tóxico verde (sobrevivência).
- Iluminação: o subsolo escurece com a profundidade e as salas acesas abrem luz quente em volta; sala sem energia fica no escuro (sinal visual de falha).
- Grade lateral (corte do terreno) de 30×16 células. O bunker é visto de lado, como um formigueiro.
- Zoom/arrasto feitos escalando um Container em vez de duas câmeras, para manter o teste de toque simples e correto.
- Fontes: Fredoka (interface e textos) e Lilita One (logo e títulos), via Google Fonts, com espera máxima de 2,5 s e fallback monospace se não houver rede.
- `tick` é puro (copia o estado). A simulação em lote usa `tickMut` para não copiar a cada hora.
- O estado do RNG (mulberry32) mora dentro do estado da run; salvar a run salva a sequência aleatória, então a retomada é exata.
- Nomes de pessoas guardados como índice (`nameId`) no núcleo; o texto do nome fica no arquivo de idioma.
- Botões têm área de toque mínima de 40 px do jogo (≈44 px de tela num celular comum), mesmo quando o desenho é menor.

## Regras de jogo
- **Derrota**: a run termina quando o viajante morre (de qualquer causa, inclusive motim vencedor). Mortes de outros sobreviventes não encerram a run; senão o Final Solitário seria impossível.
- **Construção**: a primeira sala precisa ser um corredor na superfície (entrada). Toda sala nova precisa encostar numa existente. Colocar uma sala escava automaticamente as células que faltam (custo em minutos visível).
- **Profundidade oculta**: cada tipo tem profundidade mínima secreta. Sala rasa demais é construída mesmo assim, aparece com rachaduras, poeira e fala do narrador, e desmorona na explosão. A habilidade Sondagem avisa antes.
- **Terra escavada**: vira recurso de reforço (Reforçar gasta terra) e de aterro (tapar buracos que quebram a vedação).
- **Peças** (sucata) são o recurso de conserto: começa com algumas e rocha escavada às vezes rende mais. Contagens de inventário (terra, peças) aparecem como números; todos os sistemas (comida, água, ar, energia, ânimo) aparecem só como medidores qualitativos e sinais.
- **Escotilha** começa aberta na construção (você está cavando). Esquecer de fechar antes da explosão é punido; o narrador lembra no último dia.
- **Vedação**: sala é "aberta" se encosta em túnel vazio, no céu, tem brecha, ou é a entrada com escotilha aberta.
- **Energia**: só chega a salas no mesmo componente conexo de um painel; a produção conta geradores desse componente. Prioridade é por tipo de sala.
- **Emergências** aparecem na lista lateral com alerta sonoro, sem pausar (com até 6 por dia, pausar sempre seria cansativo). Quem não responde até o fim do dia recebe a última opção ("deixar como está"). Catástrofes, sobreviventes e motim pausam.
- **Opções demoradas** resolvem horas depois em vez de gastar o relógio.
- **Motim**: negociar ou reprimir podem falhar (motim vence = derrota por motim). Ceder nunca é derrota: os insatisfeitos vão embora com metade dos recursos. Motim contido deixa uma marca que reduz a moral diária.
- **Recusar sobrevivente** conta como abandono (para o Final Solitário), fortalece a Tribo das Máscaras e, a partir de duas recusas, pode agendar uma invasão extra.
- **Equipamentos**: um por sala, só na construção, custam peças e minutos. São liberados por entradas do diário (ex.: morrer sufocado libera o filtro) e por habilidades.
- **Finais** (prioridade): Ruptura (≥35% das salas desabadas ou integridade média baixa no fim) → Solitário (só o viajante vivo e houve abandono/sacrifício) → Coletivo (≥2 aceitos, todos vivos, sem motim, ânimo ≥60) → Cinismo (o resto).
- **Progressão**: runs 1–3: 30 dias, 1 catástrofe, sem motim; runs 4+: 2 catástrofes e motim; após o primeiro final: 60 dias e catástrofes 30% mais fortes; após todos: 90 dias e 50% mais fortes.
- **Estrutura** (quinto ramo) libera depois da primeira vitória.
- **Duração**: uma run vencida leva ~40 min em 1x (10 de construção + 30 dias). Uma jornada típica com vitória, com as mortes e loops no caminho, fica em 2–3 h.

## Balanceamento (simulação em lote, 90 runs, bot simples, sem habilidades, dificuldade de run 4+)
- Bunker mínimo (sem estufa): 0% de vitória, ~11 dias. Bunker equilibrado: ~30%. Complexo: ~43%.
- Emergências/dia: 1,2 (mínimo) → 1,6 → 2,0 (complexo).
- Causas mais comuns: fome, sufocamento, doença, sede.
- O bot aceita todo mundo e escolhe sempre a primeira opção; um jogador atento vence mais, e as habilidades acumuladas entre loops empurram a taxa para cima — é o desenho do loop.

## Fora do escopo
- Nenhum bloqueio, licença ou restrição de plataforma (será outro sistema). O jogo está separado em camadas para isso.
