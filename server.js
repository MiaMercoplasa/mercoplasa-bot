/**
 * Bot de atendimento WhatsApp — Mercoplasa
 * MIA (assistente virtual) guia o cliente por um menu de setores e recolhe
 * os dados iniciais antes de encaminhar para atendimento humano.
 *
 * Como funciona:
 *  1. Mensagem nova de um numero -> envia menu (lista interativa + fallback numerico).
 *  2. Cliente escolhe um setor -> bot faz 1 pergunta de qualificacao daquele setor.
 *  3. Cliente responde -> bot confirma o encaminhamento e (opcionalmente) avisa o atendente.
 *
 * Sem mensalidade: usa a API oficial da Meta (Cloud API) diretamente.
 * Veja README.md para o passo a passo de configuracao e deploy gratuito.
 */

const express = require("express");
const app = express();
app.use(express.json());

// ---------- Configuracao (variaveis de ambiente) ----------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mercoplasa_verify_token";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
const GRAPH_VERSION = process.env.GRAPH_VERSION || "v21.0";
const ATENDENTE_WHATSAPP_NUMBER = process.env.ATENDENTE_WHATSAPP_NUMBER || "";

const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

// ---------- Estado da conversa (em memoria) ----------
const conversas = new Map(); // wa_id -> { etapa, setor }

// ---------- Conteudo ----------
const SAUDACAO =
        "Bem-vindo a Mercoplasa \u{1F499}\n" +
        "Me chamo MIA, assistente virtual da Mercoplasa.\n" +
                "Sera um prazer atender sua empresa!\n" +
                "Selecione abaixo o setor desejado:";

const MENSAGEM_FINAL_COMERCIAL =
        "Grata pelas informacoes!\n" +
        "Logo nosso representante entrara em contato para lhe atender.\n" +
        "Obrigada por escolher a Mercoplasa! \u{1F499}";

const SETORES = [
    { id: "comercial", numero: "1", titulo: "Comercial - Cotacao", tipo: "comercial" },
    { id: "status_pedido", numero: "2", titulo: "Status de Pedido", tipo: "handoff", contato: "5547992392006" },
    { id: "financeiro", numero: "3", titulo: "Financeiro", tipo: "handoff", contato: "5548991932178" },
    { id: "compras", numero: "4", titulo: "Compras - Fornecedores", tipo: "handoff", contato: "5511911524093" },
    { id: "rh", numero: "5", titulo: "RH - Trabalhe Conosco", tipo: "handoff", contato: "5548991933176" },
    ];

function mensagemHandoff(setor) {
        return `Encaminhando voce para o setor de ${setor.titulo}! Continue o atendimento por aqui: https://wa.me/${setor.contato}`;
}

// ---------- Corrige numeros brasileiros sem o 9o digito do celular ----------
function normalizarNumeroBR(numero) {
            if (numero && numero.startsWith("55") && numero.length === 12) {
                                    const ddd = numero.slice(2, 4);
                                    const local = numero.slice(4);
                                    if (local.length === 8) {
                                                                            return "55" + ddd + "9" + local;
                                    }
            }
            return numero;
}

// ---------- Verificacao do webhook ----------
app.get("/webhook", (req, res) => {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

              if (mode === "subscribe" && token === VERIFY_TOKEN) {
                                  console.log("Webhook verificado com sucesso.");
                                  return res.status(200).send(challenge);
              }
        return res.sendStatus(403);
});

// ---------- Recebimento de mensagens ----------
app.post("/webhook", async (req, res) => {
        res.sendStatus(200);

               try {
                                    const entry = req.body.entry?.[0];
                                    const change = entry?.changes?.[0];
                                    const value = change?.value;
                                    const message = value?.messages?.[0];
                                    if (!message) return;

                         const from =normalizarNumeroBR(message.from);
                                    const nomeCliente = value?.contacts?.[0]?.profile?.name || "";

                         const textoRecebido = extrairTexto(message);
                                    const estado = conversas.get(from);

                         if (!estado) {
                                           await enviarMenu(from);
                                           conversas.set(from, { etapa: "aguardando_setor" });
                                           return;
                         }

                         if (estado.etapa === "aguardando_setor") {
                                           const setor = identificarSetor(textoRecebido, message);
                                           if (!setor) {
                                                                       await enviarTexto(from, "Nao entendi. Pode escolher uma das opcoes da lista, ou responder com o numero de 1 a 5?");
                                                                       return;
                                           }

                                           if (setor.tipo === "handoff") {
                                                                       await enviarTexto(from, mensagemHandoff(setor));
                                                                       conversas.delete(from);
                                                                       return;
                                           }

                                           await enviarTexto(from, "Perfeito! Para iniciar seu atendimento, me informe o CNPJ ou CPF da empresa/cliente:");
                                           conversas.set(from, { etapa: "comercial_cnpj", dados: {} });
                                           return;
                         }

                         if (estado.etapa === "comercial_cnpj") {
                                           estado.dados.cnpjCpf = textoRecebido;
                                           await enviarTexto(from, "Perfeito! Agora me informe o nome (ou razao social):");
                                           conversas.set(from, { etapa: "comercial_nome", dados: estado.dados });
                                           return;
                         }

                         if (estado.etapa === "comercial_nome") {
                                           estado.dados.nome = textoRecebido;
                                           await enviarTexto(from, "Qual modelo de nossa linha voce tem interesse?");
                                           conversas.set(from, { etapa: "comercial_modelo", dados: estado.dados });
                                           return;
                         }

                         if (estado.etapa === "comercial_modelo") {
                                           estado.dados.modelo = textoRecebido;
                                           await enviarTexto(from, MENSAGEM_FINAL_COMERCIAL);
                                           if (ATENDENTE_WHATSAPP_NUMBER) {
                                                                       await enviarTexto(
                                                                                                               ATENDENTE_WHATSAPP_NUMBER,
                                                                                                               `Novo contato Comercial via bot\nCliente: ${nomeCliente || from}\nTelefone: ${from}\nCNPJ/CPF: ${estado.dados.cnpjCpf}\nNome: ${estado.dados.nome}\nModelo de interesse: ${estado.dados.modelo}`
                                                                                                             ).catch((e) => console.log("Aviso ao atendente falhou (normal se a janela de 24h nao estiver aberta):", e.message));
                                           }
                                           conversas.delete(from);
                                           return;
                         }
           } catch (err) {
                 console.error("Erro ao processar mensagem:", err);
           }
});

// ---------- Helpers de conteudo ----------
function extrairTexto(message) {
    if (message.type === "text") return message.text.body;
    if (message.type === "interactive") {
          if (message.interactive.type === "list_reply") return message.interactive.list_reply.id;
          if (message.interactive.type === "button_reply") return message.interactive.button_reply.id;
    }
    return "";
}

function identificarSetor(texto, message) {
    const limpo = (texto || "").trim().toLowerCase();
    if (message.type === "interactive" && message.interactive.type === "list_reply") {
          const id = message.interactive.list_reply.id.replace("setor_", "");
          return SETORES.find((s) => s.id === id);
    }
    return SETORES.find((s) => s.numero === limpo || limpo.includes(s.id));
}

// ---------- Helpers de envio (Cloud API) ----------
async function chamarGraphAPI(payload) {
    const resp = await fetch(GRAPH_URL, {
          method: "POST",
          headers: {
                  Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                  "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(data));
    return data;
}

function enviarTexto(to, body) {
    return chamarGraphAPI({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
    });
}

function enviarMenu(to) {
    return chamarGraphAPI({
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
                  type: "list",
                  body: { text: SAUDACAO },
                  action: {
                            button: "Selecionar opcao",
                            sections: [
                              {
                                            title: "Setores Mercoplasa",
                                            rows: SETORES.map((s) => ({
                                                            id: `setor_${s.id}`,
                                                            title: s.titulo,
                                                            description: "",
                                            })),
                              },
                                      ],
                  },
          },
    });
}

// ---------- Saude do servico ----------
app.get("/", (req, res) => res.send("Bot Mercoplasa no ar."));
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
