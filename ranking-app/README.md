# Ranking RQT 2026

Cópia independente do Ranking RQT 2025, mantendo React, Vite, logotipo, tipografia e cores originais. O projeto anterior não é alterado.

## Regras

Referência: edital oficial 2026, páginas impressas 14 e 24 (páginas 15 e 25 do PDF).

| Modalidade | Classificação | Desempates, em ordem |
| --- | --- | --- |
| Teleoperado | Média das pontuações das partidas válidas disputadas | Melhor partida, segunda melhor, terceira melhor |
| Híbrido | Soma das pontuações das partidas válidas disputadas | Método autônomo, melhor partida, segunda melhor, menos penalidades |

A pontuação final de cada partida é lida da coluna J (`Pontuação`) da aba `CALC`. Conforme confirmado pelo organizador, a planilha já considera os discos de penalidades. O multiplicador autônomo de 2,5 também já está nessa pontuação. O site não recalcula missões, não desconta discos e não reaplica o multiplicador. A quantidade de penalidades é usada somente no desempate híbrido previsto no edital.

Interpretação confirmada pelo organizador para equipes que alternem o método: mais partidas autônomas têm prioridade no desempate do híbrido. O edital prevê duas partidas híbridas por equipe; o site sinaliza quando houver mais lançamentos.

O edital lista somente as três melhores partidas como desempates teleoperados. A quarta partida não cria um critério adicional. Empates em todos os critérios publicados compartilham a posição (1, 1, 3). A ordem alfabética dentro de um empate serve apenas para exibição. Equipes sem partidas aparecem como aguardando.

A média é comparada sem arredondamento. A tela exibe até duas casas decimais, com o valor completo disponível ao passar o mouse.

## Fontes de dados

As planilhas originais permanecem inalteradas. IDs em `server/sheets.js`:

* Teleoperado: `1IhxtO3SryJfG6fdzF0YbAsA0XQAuG6uskdgDTPMY8HQ`.
* Híbrido: `1EHN2M7NUj8cuzqTLMfPirKEbsr7a1B3NyW3MFyJZx_E`.

O site lê as abas `DATA`, `CALC` e a coluna A de `Ranking Cat1` e `Ranking Cat2`. As listas dessas duas últimas abas determinam a categoria. As fórmulas de totais das abas de ranking não são usadas, pois há referências quebradas e a planilha teleoperada soma em vez de calcular a média prevista no edital.

A API associa cada resposta de `DATA` à partida de `CALC` pelo número e valida a correspondência das equipes, penalidades e método. Cada membro da aliança teleoperada recebe os pontos finais da partida. Nomes são comparados sem diferenças de maiúsculas, acentos e espaços, sem aproximação entre nomes diferentes. Partidas duplicadas em `DATA` mantêm a primeira resposta, de acordo com o XLOOKUP das planilhas. Corrija a resposta existente para corrigir uma partida. Pontuações ausentes, erros de fórmula ou dados ainda inconsistentes não entram no ranking e geram avisos visíveis; o site não tenta substituir a pontuação da planilha por um cálculo próprio. Partidas pré-cadastradas em `CALC` sem resposta em `DATA` permanecem aguardando.

O acesso padrão usa a exportação CSV de leitura do Google, com `headers=1`. Isso exige acesso anônimo de leitura às planilhas. Não é feita alteração automática de compartilhamento. Uma chave `GOOGLE_SHEETS_API_KEY` opcional permite usar a Sheets API no servidor para planilhas acessíveis por chave; ela não dá acesso a arquivos privados. Nunca use credenciais com prefixo `VITE_`. Para uma fonte privada, configure uma integração de serviço autorizada antes de publicar.

Atualização automática a cada 30 segundos, inclusive com a alternância pausada. A API possui cache de até dez segundos. Em falhas, a última leitura válida daquela modalidade permanece visível com um aviso e seu horário. Uma modalidade indisponível não apaga a outra. Não há dados fictícios na aplicação de produção.

## Telão

A alternância inicia ao abrir a página: híbrido categoria 1, híbrido categoria 2, teleoperado categoria 1, teleoperado categoria 2. Cada categoria é paginada conforme a altura disponível, mostrando todas as equipes antes de avançar. A duração padrão por página é 40 segundos e pode ser alterada. Os controles permitem pausar, avançar, voltar, escolher categoria, atualizar, entrar em tela cheia e ocultar os controles.

As colunas mostram pontuação principal, número de partidas e pontuações de desempate. O híbrido também mostra partidas autônomas e penalidades.

## Desenvolvimento e verificação

```sh
cd ranking-app
npm install
npm test
npm run build
```

`npm run dev` serve a interface Vite. Para testar a API junto com a interface localmente, use `vercel dev` em um projeto vinculado, ou teste os módulos puros com `npm test`.

Os testes cobrem preservação da pontuação final, ausência de desconto ou multiplicador duplicado, média contra soma, vantagem autônoma, desempates, posições compartilhadas, duplicatas, categoria, nomes, correspondência entre abas e erros de leitura. Não escrevem nas planilhas.

## Publicação

Na Vercel, importe o novo repositório com Root Directory `ranking-app`, framework Vite e comando `npm run build`. O diretório de saída é `dist`; a pasta `api` é publicada como funções Node. A produção usa a branch `main`. Confirme o acesso real às planilhas antes de usar no evento.

## Divergências encontradas

1. Teleoperado: o edital exige média; as abas de ranking das planilhas somam pontos.
2. Híbrido: o último desempate é menos penalidades.
3. Teleoperado: o edital encerra os critérios na terceira melhor partida, sem mencionar quarta ou seguintes.
4. Algumas fórmulas teleoperadas contêm `#REF!`.

A aplicação segue o edital para classificação e desempate, com a interpretação de método confirmada pelo organizador. A pontuação das partidas, inclusive os descontos dos discos, permanece sob responsabilidade da planilha, conforme orientação do organizador. As imagens de pontuação herdadas na raiz do repositório são do sistema de 2025; não são usadas como regras de 2026.

## Cronograma do telão

O botão Ranking / Cronograma alterna as telas. O link `/#cronograma` abre diretamente a programação. As seções disponíveis são programação geral, mesas híbridas, mesas teleoperadas, Desafio Pesquisa e números das equipes. Cada seção possui paginação automática, pausa, navegação manual e duração configurável. A alternância do ranking é suspensa enquanto o cronograma está aberto.

A API `/api/schedule` lê somente `cronograma impressão!A1:H150` da planilha `1MoXLsNdB4P640zFobHNeUsguvxNHx9WrA4RWYuv0Ma0` (gid `1518659089`). A exportação CSV preserva os campos mistos que a inferência de tipos do gviz omite. A atualização ocorre a cada 30 segundos, com cache de até 10 segundos; falhas preservam os últimos dados válidos e mostram um aviso. Os horários são apresentados como previstos, sem inferir a atividade em andamento ou uma data não informada na planilha. A identificação de alianças usa somente a relação de equipes da mesma aba.
