const form = document.querySelector('#agentForm');
const avatarForm = document.querySelector('#avatarAgentForm');
const chatForm = document.querySelector('#chatForm');
const messages = document.querySelector('#messages');
const emptyState = document.querySelector('#emptyState');
const historyList = document.querySelector('#historyList');
const draftAgentList = document.querySelector('#draftAgentList');
const publishedAgentList = document.querySelector('#publishedAgentList');
const historySearch = document.querySelector('#historySearch');
const statusNode = document.querySelector('#status');
const avatarStatusNode = document.querySelector('#avatarStatus');
const chatStatusNode = document.querySelector('#chatStatus');
const mcpStatusNode = document.querySelector('#mcpStatus');
const sendButton = document.querySelector('#sendButton');
const actionButtons = Array.from(form.querySelectorAll('button[name="action"]'));
const avatarSubmitButton = document.querySelector('#avatarSubmitButton');
const newChatButton = document.querySelector('#newChatButton');
const myAgentsButton = document.querySelector('#myAgentsButton');
const agentModal = document.querySelector('#agentModal');
const closeAgentModal = document.querySelector('#closeAgentModal');
const categorySelect = form.querySelector('select[name="category"]');
const customCategoryField = document.querySelector('#customCategoryField');
const customCategoryInput = form.querySelector('input[name="customCategory"]');
const questionnaireToggle = document.querySelector('#questionnaireToggle');
const questionnairePanel = document.querySelector('#questionnairePanel');
const moduleTitle = document.querySelector('#moduleTitle');

const historyKey = 'another-me-agent-launch-history';
let conversations = JSON.parse(localStorage.getItem(historyKey) || '[]');
let activeConversationId = conversations[0]?.id || crypto.randomUUID();
let activeAgentId = localStorage.getItem('another-me-active-agent-id') || '';
let activeAgentName = localStorage.getItem('another-me-active-agent-name') || '';
let currentMcp = JSON.parse(localStorage.getItem('another-me-current-mcp') || 'null');
let agents = [];

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

const agentStatusLabel = (status) => {
  if (status === 'published') return '已发布';
  if (status === 'draft') return '草稿';
  return '测试中';
};

const loadAgents = async () => {
  const response = await fetch('/api/module-agent-launch/agents');
  agents = await response.json().catch(() => []);
  if (!Array.isArray(agents)) agents = [];
  renderAgents();
};

const selectAgent = (agent) => {
  const displayName = agent.name || '未命名';
  activeAgentId = agent.id;
  activeAgentName = displayName;
  localStorage.setItem('another-me-active-agent-id', activeAgentId);
  localStorage.setItem('another-me-active-agent-name', activeAgentName);
  setStatus(chatStatusNode, `当前测试对象：${displayName}`, 'ok');
  setStatus(statusNode, `已选中 ${displayName}。中间对话会使用这个 Agent。`, 'ok');
};

const renderAgents = () => {
  const createAgentButton = (agent) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.innerHTML = `<strong></strong><span></span>`;
    const displayName = agent.name || '未命名';
    button.querySelector('strong').textContent = displayName;
    button.querySelector('span').textContent = `${agentStatusLabel(agent.status)} · ${agent.tagline || agent.category || '未填写简介'}`;
    button.addEventListener('click', () => {
      selectAgent(agent);
      agentModal.hidden = true;
    });
    return button;
  };
  const drafts = agents.filter((agent) => agent.status !== 'published');
  const published = agents.filter((agent) => agent.status === 'published');
  const emptyDraft = document.createElement('div');
  emptyDraft.className = 'empty-list';
  emptyDraft.textContent = '暂无草稿';
  const emptyPublished = document.createElement('div');
  emptyPublished.className = 'empty-list';
  emptyPublished.textContent = '暂无已发布';
  draftAgentList.replaceChildren(...(drafts.length ? drafts.map(createAgentButton) : [emptyDraft]));
  publishedAgentList.replaceChildren(...(published.length ? published.map(createAgentButton) : [emptyPublished]));
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

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const value = String(reader.result || '');
    resolve(value.includes(',') ? value.split(',').pop() : value);
  });
  reader.addEventListener('error', () => reject(reader.error || new Error('文件读取失败')));
  reader.readAsDataURL(file);
});

const askRuntime = async (message) => {
  const response = await fetch('/api/module-agent-launch/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, agentId: activeAgentId }),
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

const updateAgent = async (agentId, agent) => {
  const response = await fetch(`/api/module-agent-launch/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
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

historySearch.addEventListener('input', () => {
  renderHistory();
});

myAgentsButton.addEventListener('click', async () => {
  await loadAgents();
  agentModal.hidden = false;
});

const initialAgentId = new URLSearchParams(window.location.search).get('agentId');
if (initialAgentId) {
  loadAgents().then(() => {
    const agent = agents.find((item) => item.id === initialAgentId);
    if (agent) selectAgent(agent);
  });
}

closeAgentModal.addEventListener('click', () => {
  agentModal.hidden = true;
});

agentModal.addEventListener('click', (event) => {
  if (event.target.matches('[data-close-agent-modal]')) agentModal.hidden = true;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') agentModal.hidden = true;
});

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
  const action = event.submitter?.value || 'update';
  actionButtons.forEach((button) => { button.disabled = true; });
  setStatus(statusNode, action === 'publish' ? '正在发布 Agent...' : action === 'draft' ? '正在保存草稿...' : '正在更新 Agent...');
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const skillZip = values.skillZip;
    const hasSkillZip = Boolean(skillZip && skillZip.name);
    const isDraft = action === 'draft';
    if (hasSkillZip && !skillZip.name.toLowerCase().endsWith('.zip')) {
      throw new Error('请上传正确格式的 Agent 文件');
    }
    const demoVideo = values.demoVideo;
    const demoVideoNote = demoVideo && demoVideo.name
      ? [`视频 Demo 文件：${demoVideo.name}`, `视频 Demo 大小：${Math.ceil(demoVideo.size / 1024)} KB`]
      : [];
    const category = values.category === '其他' ? String(values.customCategory || '').trim() : values.category;
    if (!isDraft && !category) throw new Error('请填写具体赛道');
    const description = [
      values.description,
      hasSkillZip ? `技能包文件：${skillZip.name}` : `技能包文件：沿用当前已接入的 ${activeAgentName || 'Agent'}`,
      hasSkillZip ? `技能包大小：${Math.ceil(skillZip.size / 1024)} KB` : '',
      ...demoVideoNote,
      '运行方式：Another Me 会解压 skill zip，并把解压出的 skill 内容与这里填写的文字描述一起接入对话。',
    ].filter(Boolean).join('\n\n');
    const skillZipBase64 = hasSkillZip ? await fileToBase64(skillZip) : '';
    const status = action === 'publish' ? 'published' : action === 'draft' ? 'draft' : 'testing';
    if (action === 'publish' && (!values.owner || !values.description)) {
      throw new Error('发布前请填写上传者和详细简介');
    }
    const agentName = String(values.name || '').trim() || '未命名';
    const profileText = String(values.description || '').trim() || '未填写画像';
    const payload = {
      name: agentName,
      owner: values.owner || (isDraft ? '未填写' : ''),
      tagline: values.tagline,
      description,
      skillPrompt: [
        `# Uploaded Agent Skill: ${agentName || 'Unnamed Agent'}`,
        '',
        profileText,
        '',
        hasSkillZip ? `Skill package: ${skillZip.name}` : 'Skill package: none. Use the written profile as the agent behavior.',
        `Category: ${category}`,
        'Instruction: use both the uploaded skill package and the written description when a skill exists. If no skill exists, the written description is the full agent profile.',
      ].filter(Boolean).join('\n'),
      skillZipName: hasSkillZip ? skillZip.name : '',
      skillZipBase64,
      runtimeType: 'another-me-skill-runtime',
      chatUrl: `https://example.com/skill-agent/${encodeURIComponent(agentName || 'unnamed')}`,
      apiUrl: '',
      repoUrl: '',
      demoVideoUrl: '',
      eventName: '',
      category,
      status,
      mcpConfig: currentMcp,
    };
    const result = activeAgentId ? await updateAgent(activeAgentId, payload) : await publishAgent(payload);
    activeAgentId = result.id;
    activeAgentName = result.name;
    localStorage.setItem('another-me-active-agent-id', activeAgentId);
    localStorage.setItem('another-me-active-agent-name', activeAgentName);
    form.reset();
    syncCustomCategory();
    await loadAgents();
    const verb = action === 'publish' ? '已发布' : action === 'draft' ? '已存为草稿' : '已更新';
    setStatus(statusNode, `${verb} ${result.name}。可以在中间对话框继续测试，发现问题后再更新。`, 'ok');
    setStatus(chatStatusNode, `当前测试对象：${result.name}`, 'ok');
  } catch (error) {
    setStatus(statusNode, `操作失败：${error.message}`, 'error');
  } finally {
    actionButtons.forEach((button) => { button.disabled = false; });
  }
});

document.querySelector('#mcpForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  currentMcp = {
    name: String(values.mcpName || '').trim(),
    endpoint: String(values.mcpEndpoint || '').trim(),
    purpose: String(values.mcpPurpose || '').trim(),
  };
  const hasMcp = currentMcp.name || currentMcp.endpoint || currentMcp.purpose;
  if (!hasMcp) currentMcp = null;
  localStorage.setItem('another-me-current-mcp', JSON.stringify(currentMcp));
  setStatus(mcpStatusNode, currentMcp ? 'MCP 配置已暂存，会随当前 Agent 一起保存。' : '未配置 MCP，不影响 Agent 使用。', 'ok');
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
if (!initialAgentId) loadAgents();
