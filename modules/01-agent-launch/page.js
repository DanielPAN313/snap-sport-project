const form = document.querySelector('#agentForm');
const avatarForm = document.querySelector('#avatarAgentForm');
const chatForm = document.querySelector('#chatForm');
const messages = document.querySelector('#messages');
const emptyState = document.querySelector('#emptyState');
const historyList = document.querySelector('#historyList');
const historySearch = document.querySelector('#historySearch');
const statusNode = document.querySelector('#status');
const avatarStatusNode = document.querySelector('#avatarStatus');
const chatStatusNode = document.querySelector('#chatStatus');
const mcpStatusNode = document.querySelector('#mcpStatus');
const sendButton = document.querySelector('#sendButton');
const submitButton = document.querySelector('#submitButton');
const avatarSubmitButton = document.querySelector('#avatarSubmitButton');
const newChatButton = document.querySelector('#newChatButton');
const categorySelect = form.querySelector('select[name="category"]');
const customCategoryField = document.querySelector('#customCategoryField');
const customCategoryInput = form.querySelector('input[name="customCategory"]');
const questionnaireToggle = document.querySelector('#questionnaireToggle');
const questionnairePanel = document.querySelector('#questionnairePanel');
const moduleTitle = document.querySelector('#moduleTitle');

const historyKey = 'another-me-agent-launch-history';
let conversations = JSON.parse(localStorage.getItem(historyKey) || '[]');
let activeConversationId = conversations[0]?.id || crypto.randomUUID();

const saveHistory = () => localStorage.setItem(historyKey, JSON.stringify(conversations.slice(0, 40)));

const setStatus = (node, message, type = '') => {
  node.textContent = message;
  node.className = `status ${type}`.trim();
};

const ensureConversation = () => {
  let conversation = conversations.find((item) => item.id === activeConversationId);
  if (!conversation) {
    conversation = {
      id: activeConversationId,
      title: '新的 Another Me 对话',
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    conversations.unshift(conversation);
  }
  return conversation;
};

const renderHistory = () => {
  const keyword = historySearch.value.trim().toLowerCase();
  const items = conversations.filter((item) => {
    if (!keyword) return true;
    return `${item.title} ${item.messages.map((message) => message.text).join(' ')}`.toLowerCase().includes(keyword);
  });
  historyList.replaceChildren(...items.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector('strong').textContent = item.title;
    button.querySelector('span').textContent = item.messages.at(-1)?.text || '还没有消息';
    button.addEventListener('click', () => {
      activeConversationId = item.id;
      renderMessages();
    });
    return button;
  }));
};

const renderMessages = () => {
  const conversation = conversations.find((item) => item.id === activeConversationId);
  messages.replaceChildren();
  for (const message of conversation?.messages || []) addMessage(message.role, message.text, false);
  emptyState.hidden = Boolean(conversation?.messages?.length);
};

const addMessage = (role, text, persist = true) => {
  const item = document.createElement('article');
  item.className = `message ${role}`;
  const label = role === 'user' ? '你' : role === 'assistant' ? 'Another Me' : '系统';
  item.innerHTML = `<strong></strong><pre></pre>`;
  item.querySelector('strong').textContent = label;
  item.querySelector('pre').textContent = text;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  emptyState.hidden = true;

  if (persist) {
    const conversation = ensureConversation();
    conversation.messages.push({ role, text });
    if (role === 'user' && conversation.messages.length <= 1) conversation.title = text.slice(0, 28) || conversation.title;
    conversation.updatedAt = new Date().toISOString();
    conversations = [conversation, ...conversations.filter((entry) => entry.id !== conversation.id)];
    saveHistory();
    renderHistory();
  }
  return item;
};

const askRuntime = async (message) => {
  const response = await fetch('/api/module-agent-launch/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
};

const publishAgent = async (agent) => {
  const response = await fetch('/api/module-agent-launch/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
};

const buildQuestionnaireProfile = (values) => {
  const excluded = new Set(['personName', 'role', 'skills', 'personality', 'homepageUrl']);
  const entries = Object.entries(values)
    .filter(([key, value]) => !excluded.has(key) && String(value || '').trim())
    .map(([key, value]) => `${key}：${String(value).trim()}`);

  return entries.length ? `人格问卷补充：\n${entries.join('\n')}` : '';
};

const distillPersonaSkill = (values, description) => [
  '# Persona Skill',
  '',
  '## Identity',
  `You are the avatar agent for ${values.personName}.`,
  `Role: ${values.role}.`,
  '',
  '## Core Capabilities',
  values.skills,
  '',
  '## Personality And Voice',
  values.personality,
  '',
  '## Homepage',
  values.homepageUrl || 'Not provided.',
  '',
  '## Full Persona Notes',
  description,
  '',
  '## LLM API Status',
  'Placeholder only. Waiting for the user-provided LLM API endpoint and authentication before injection.',
].join('\n');

const createAvatarRuntime = async (skill) => ({
  status: 'placeholder',
  skill,
  chatUrl: '',
  apiUrl: '',
  note: 'LLM API not connected yet.',
});

const syncCustomCategory = () => {
  const needsCustomCategory = categorySelect.value === '其他';
  customCategoryField.hidden = !needsCustomCategory;
  customCategoryInput.required = needsCustomCategory;
  if (!needsCustomCategory) customCategoryInput.value = '';
};

const openModule = (name) => {
  const titleMap = { skill: 'Skill', mcp: 'MCP', another: 'Another Me' };
  moduleTitle.textContent = titleMap[name] || 'Skill';
  document.querySelectorAll('.module-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${name}Module`));
  document.querySelectorAll('.module-tab, .tool-chip').forEach((button) => button.classList.toggle('active', button.dataset.module === name));
};

categorySelect.addEventListener('change', syncCustomCategory);
syncCustomCategory();

historySearch.addEventListener('input', renderHistory);

newChatButton.addEventListener('click', () => {
  activeConversationId = crypto.randomUUID();
  messages.replaceChildren();
  emptyState.hidden = false;
  setStatus(chatStatusNode, '已新建对话。');
});

document.querySelectorAll('[data-module]').forEach((button) => {
  button.addEventListener('click', () => openModule(button.dataset.module));
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    chatForm.message.value = button.dataset.prompt;
    chatForm.message.focus();
  });
});

questionnaireToggle.addEventListener('click', () => {
  const shouldOpen = questionnairePanel.hidden;
  questionnairePanel.hidden = !shouldOpen;
  questionnaireToggle.setAttribute('aria-expanded', String(shouldOpen));
  questionnaireToggle.textContent = shouldOpen ? '收起精准化问卷' : '填写精准化问卷';
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = String(new FormData(chatForm).get('message') || '').trim();
  if (!message) return;
  addMessage('user', message);
  chatForm.reset();
  sendButton.disabled = true;
  setStatus(chatStatusNode, '思考中...');
  const pending = addMessage('system', '思考中', false);
  try {
    const result = await askRuntime(message);
    pending.remove();
    addMessage('assistant', result.output || '没有返回文本。');
    setStatus(chatStatusNode, '完成。', 'ok');
  } catch (error) {
    pending.remove();
    addMessage('system', error.message);
    setStatus(chatStatusNode, '调用失败。请检查模型配置。', 'error');
  } finally {
    sendButton.disabled = false;
    chatForm.message.focus();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus(statusNode, '正在读取 Agent 文件...');
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const skillZip = values.skillZip;
    if (!skillZip || !skillZip.name || !skillZip.name.toLowerCase().endsWith('.zip')) {
      throw new Error('请上传正确格式的 Agent 文件');
    }
    const demoVideo = values.demoVideo;
    const demoVideoNote = demoVideo && demoVideo.name
      ? [`视频 Demo 文件：${demoVideo.name}`, `视频 Demo 大小：${Math.ceil(demoVideo.size / 1024)} KB`]
      : [];
    const category = values.category === '其他' ? String(values.customCategory || '').trim() : values.category;
    if (!category) throw new Error('请填写具体赛道');
    const description = [
      values.description,
      `技能包文件：${skillZip.name}`,
      `技能包大小：${Math.ceil(skillZip.size / 1024)} KB`,
      ...demoVideoNote,
      '运行方式：后续由 Another Me 解压 skill zip，并通过固定系统提示词接入 LLM。',
    ].join('\n\n');
    const result = await publishAgent({
      name: values.name,
      owner: values.owner,
      tagline: values.tagline,
      description,
      skillPrompt: [
        `# Uploaded Agent Skill: ${values.name}`,
        '',
        values.description,
        '',
        `Skill package: ${skillZip.name}`,
        `Category: ${category}`,
        'Instruction: behave according to the uploaded skill package. The real zip extraction step is reserved for Another Me.',
      ].join('\n'),
      runtimeType: 'another-me-skill-runtime',
      chatUrl: `https://example.com/skill-agent/${encodeURIComponent(values.name)}`,
      apiUrl: '',
      repoUrl: '',
      demoVideoUrl: '',
      eventName: '',
      category,
    });
    form.reset();
    syncCustomCategory();
    setStatus(statusNode, `已记录 ${result.name}。真实解析和 LLM 接入位置已预留。`, 'ok');
  } catch (error) {
    setStatus(statusNode, `上传失败：${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#mcpForm').addEventListener('submit', (event) => {
  event.preventDefault();
  setStatus(mcpStatusNode, 'MCP 配置已暂存。Another Me 接入位置已预留。', 'ok');
  event.currentTarget.reset();
});

avatarForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  avatarSubmitButton.disabled = true;
  setStatus(avatarStatusNode, '正在生成并发布你的化身 Agent...');
  try {
    const values = Object.fromEntries(new FormData(avatarForm).entries());
    const name = `${values.personName} 的化身 Agent`;
    const description = [
      `身份：${values.role}`,
      `擅长能力：${values.skills}`,
      `性格与表达风格：${values.personality}`,
      values.homepageUrl ? `个人主页：${values.homepageUrl}` : '',
      buildQuestionnaireProfile(values),
    ].filter(Boolean).join('\n\n');
    const personaSkill = distillPersonaSkill(values, description);
    const runtime = await createAvatarRuntime(personaSkill);
    const result = await publishAgent({
      name,
      owner: values.personName,
      tagline: `${values.role} 的个人化身`,
      description,
      skillPrompt: personaSkill,
      runtimeType: 'another-me-persona-runtime',
      chatUrl: runtime.chatUrl || `https://example.com/avatar-agent/${encodeURIComponent(values.personName)}`,
      apiUrl: runtime.apiUrl,
      repoUrl: '',
      demoVideoUrl: '',
      eventName: 'Avatar Agent Builder',
      category: '个人化身',
    });
    avatarForm.reset();
    questionnairePanel.hidden = true;
    questionnaireToggle.setAttribute('aria-expanded', 'false');
    questionnaireToggle.textContent = '填写精准化问卷';
    setStatus(avatarStatusNode, `已生成 ${result.name} 的 persona skill。LLM API 接入位置已预留。`, 'ok');
  } catch (error) {
    setStatus(avatarStatusNode, `生成失败：${error.message}`, 'error');
  } finally {
    avatarSubmitButton.disabled = false;
  }
});

renderHistory();
renderMessages();
openModule('skill');
