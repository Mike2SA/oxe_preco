const express = require('express');
const http = require('http');
const puppeteer = require('puppeteer');
const { parse } = require('node-html-parser');

const app = express();
app.use(express.json());

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ─── Setup e Teste de Banco ───────────────────────────────────────────────────
require('dotenv').config();
const sequelize = require('./database/index');

sequelize.authenticate().then(() => {
    console.log('📦 Conexão com o SQL Server estabelecida com sucesso!');
}).catch(err => {
    console.error('❌ Falha ao conectar no SQL Server (Verifique seu arquivo .env):', err.message);
});

// ─── Parser ───────────────────────────────────────────────────────────────────

function toDouble(value) {
    if (!value) return 0.0;
    const cleaned = value
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        .trim();
    return parseFloat(cleaned) || 0.0;
}

function parseEstabelecimento(doc) {
    const nome = doc.querySelector('.txtTopo')?.text?.trim() ?? '';
    const divs = doc.querySelectorAll('.text');

    let cnpj = '';
    let endereco = '';

    if (divs.length > 0) {
        cnpj = divs[0].text.replace(/[^0-9./-]/g, '').trim();
    }
    if (divs.length >= 2) {
        endereco = divs[1].text.trim().replace(/\s+/g, ' ');
    }

    return { nome, cnpj, endereco };
}

function parseItens(doc) {
    const itens = [];
    const rows = doc.querySelectorAll('#tabResult tr');

    for (const row of rows) {
        const nome = row.querySelector('.txtTit')?.text?.trim() ?? '';
        if (!nome) continue;

        const codigoRaw = row.querySelector('.RCod')?.text ?? '';
        const codigo = codigoRaw.replace(/[^0-9]/g, '');

        const qtdRaw = row.querySelector('.Rqtd')?.text ?? '';
        const qtd = toDouble(qtdRaw.includes(':') ? qtdRaw.split(':').pop() : qtdRaw);

        const unRaw = row.querySelector('.RUN')?.text ?? '';
        const un = unRaw.includes(':') ? unRaw.split(':').pop().trim() : unRaw.trim();

        const vlUnitRaw = row.querySelector('.RvlUnit')?.text ?? '';
        const vlUnit = toDouble(vlUnitRaw.includes(':') ? vlUnitRaw.split(':').pop() : vlUnitRaw);

        const vlTotal = toDouble(row.querySelector('.valor')?.text);

        itens.push({
            descricao: nome,
            codigo,
            quantidade: qtd,
            unidade: un,
            preco_unitario: vlUnit,
            preco_total: vlTotal,
            preco_base: vlUnit,
        });
    }

    return itens;
}

function parseTotais(doc) {
    const totaisDiv = doc.querySelector('#totalNota');
    if (!totaisDiv) return {};

    const spans = totaisDiv.querySelectorAll('.totalNumb');

    return {
        qtd_itens: parseInt(spans[0]?.text?.trim() ?? '0') || 0,
        valor_final: toDouble(spans[1]?.text),
        valor_pago: toDouble(spans[3]?.text),
        tributos: toDouble(spans[4]?.text),
        desconto: 0.0,
    };
}

function parseMetadados(doc) {
    const chave = doc.querySelector('.chave')?.text?.replace(/\s/g, '') ?? '';

    let dataEmissao = '';
    const listItems = doc.querySelectorAll('.ui-listview li');
    for (const li of listItems) {
        const match = li.text.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (match) {
            dataEmissao = match[1];
            break;
        }
    }

    return { chave_acesso: chave, data_emissao: dataEmissao, estado: 'BA' };
}

function parseSefazHtml(html) {
    const doc = parse(html);
    return {
        estabelecimento: parseEstabelecimento(doc),
        itens: parseItens(doc),
        totais: parseTotais(doc),
        metadados: parseMetadados(doc),
    };
}

// ─── Rota ─────────────────────────────────────────────────────────────────────

app.post('/consultar-nfce', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ erro: 'URL não informada' });

    console.log('Consultando:', url);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--disable-web-security',
                '--disable-extensions',
                '--allow-running-insecure-content',
                '--disable-features=BlockInsecurePrivateNetworkRequests',
                '--unsafely-treat-insecure-origin-as-secure=http://nfe.sefaz.ba.gov.br',
            ],
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        page.on('requestfailed', (req) => {
            console.log('FALHOU:', req.url(), '-', req.failure()?.errorText);
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (e) {
            console.log('goto falhou, tentando via evaluate...', e.message);
            await page.evaluate((u) => { window.location.href = u; }, url);
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        }

        const html = await page.content();
        console.log('URL final:', page.url());

        // Faz o parse e retorna JSON direto para o Flutter
        const resultado = parseSefazHtml(html);
        console.log('Resultado:', JSON.stringify(resultado, null, 2));

        // Tenta persistir os dados da NF no banco de dados (SQL Server) via Sequelize
        try {
            const processNfceService = require('./services/ProcessNfceService');
            // Nota: Você pode obter o userId do req.body.userId caso seu app envie
            const dbResult = await processNfceService.process(resultado, req.body.userId || null);
            console.log('Persistência no DB finalizada:', dbResult);
        } catch (dbError) {
            console.error('Erro na persistência do DB (Ignorando para não quebrar o endpoint):', dbError);
        }

        res.status(200).json(resultado);

    } catch (e) {
        console.error('Erro:', e.message);
        res.status(500).json({ erro: e.message });
    } finally {
        if (browser) await browser.close();
    }
});

// ─── API Endpoint para App Mobile ─────────────────────────────────────────────
const { Compra, Mercado, ItemComprado, Variacao, Produto } = require('./models');

app.get('/api/compras', async (req, res) => {
    try {
        const compras = await Compra.findAll({
            include: [ { model: Mercado, required: false } ],
            order: [['data_compra', 'DESC'], ['created_at', 'DESC']],
            limit: 50
        });
        res.json(compras);
    } catch (e) {
        console.error(e);
        res.status(500).json({erro: e.message});
    }
});

app.get('/api/produtos/recentes', async (req, res) => {
    try {
        const itens = await ItemComprado.findAll({
            include: [
                { model: Variacao, include: [Produto] }
            ],
            order: [['created_at', 'DESC']],
            limit: 10
        });
        res.json(itens);
    } catch (e) {
        console.error(e);
        res.status(500).json({erro: e.message});
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await Produto.findAll({
            order: [['nome_base', 'ASC']]
        });
        res.json(produtos);
    } catch (e) {
        res.status(500).json({erro: e.message});
    }
});

app.get('/api/compras/itens-base', async (req, res) => {
    const { ids } = req.query;
    if (!ids) return res.json([]);
    
    try {
        const purchaseIds = ids.split(',');
        const items = await ItemComprado.findAll({
            where: { compra_id: purchaseIds },
            include: [{ 
                model: Variacao, 
                attributes: ['produto_id'],
                required: true 
            }],
            attributes: ['id']
        });
        
        const produtoIds = [...new Set(items.map(it => it.Variacao.produto_id))];
        res.json(produtoIds);
    } catch (e) {
        console.error(e);
        res.status(500).json({erro: e.message});
    }
});

app.get('/api/produtos/melhores-precos-agrupados', async (req, res) => {
    const { produtoIds } = req.query;
    if (!produtoIds) return res.json({});
    
    try {
        const ids = produtoIds.split(',');
        
        // Query complexa para encontrar o melhor preço para cada produto em cada mercado
        // Depois pegaremos o melhor mercado para cada produto
        const query = `
            WITH PrecosPorMercado AS (
                SELECT 
                    p.id as produto_id,
                    p.nome_base as produto_nome,
                    v.marca,
                    m.nome as mercado_nome,
                    ic.preco_unit_real as preco,
                    ic.id as item_id,
                    ROW_NUMBER() OVER(PARTITION BY p.id, m.id ORDER BY ic.preco_unit_real ASC) as rank_no_mercado
                FROM ItensComprados ic
                JOIN Variacoes v ON ic.variacao_id = v.id
                JOIN Produtos p ON v.produto_id = p.id
                JOIN Compras c ON ic.compra_id = c.id
                JOIN Mercados m ON c.mercado_id = m.id
                WHERE p.id IN (:ids)
            ),
            MelhorPrecoGeral AS (
                SELECT *,
                ROW_NUMBER() OVER(PARTITION BY produto_id ORDER BY preco ASC) as rank_geral
                FROM PrecosPorMercado
                WHERE rank_no_mercado = 1
            )
            SELECT * FROM MelhorPrecoGeral WHERE rank_geral = 1
        `;

        const results = await sequelize.query(query, {
            replacements: { ids },
            type: sequelize.QueryTypes.SELECT
        });

        // Agrupar por mercado para facilitar o Flutter
        const grouped = {};
        results.forEach(row => {
            if (!grouped[row.mercado_nome]) {
                grouped[row.mercado_nome] = [];
            }
            grouped[row.mercado_nome].push({
                id: row.item_id,
                nomeProduto: row.produto_nome,
                marca: row.marca,
                preco: row.preco,
                produtoId: row.produto_id
            });
        });

        res.json(grouped);
    } catch (e) {
        console.error(e);
        res.status(500).json({erro: e.message});
    }
});

const PORT = process.env.PORT || 3000;
http.createServer(app).listen(PORT, () => {
    console.log(`API Oxe Preco rodando na porta ${PORT}`);
});