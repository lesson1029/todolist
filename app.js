/**
 * To Do List Application Logic
 * Supports: CRUD, Progress Tracking, Filters/Sort/Search,
 * Collapsible Completed Tasks Section, Subtasks, LocalStorage Persistence.
 */

// --- 기본 데이터 및 상태 관리 ---
const STORAGE_KEY = 'todolist_app_items_v1';
const THEME_KEY = 'todolist_app_theme';

// Supabase 클라우드 데이터베이스 설정
const SUPABASE_URL = 'https://dtrkfaaedxgaaupkgelh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_XAHWlQ2EAjQX_GUgEDo4tg_Ry1emuWW';
let supabaseClient = null;

try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (err) {
  console.warn('Supabase 초기화 경고:', err);
}

const defaultTodos = [
  {
    id: 'sample-1',
    title: '할 일 목록 PRD 및 기획안 검토하기',
    completed: true,
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'high',
    category: '업무',
    notes: '완료된 항목도 하단에서 모아볼 수 있도록 요구사항 반영 완료',
    subtasks: [
      { id: 'sub-1', title: '1~4번 항목 작성', completed: true },
      { id: 'sub-2', title: '하단 완료 목록 추가 요청 반영', completed: true }
    ],
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    completedAt: new Date().toISOString()
  },
  {
    id: 'sample-2',
    title: '새로운 기능 추가해보기 (+ 버튼 사용)',
    completed: false,
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'high',
    category: '업무',
    notes: '상단의 입력창에 제목을 입력하고 Enter를 누르면 빠르게 추가됩니다.',
    subtasks: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: null
  },
  {
    id: 'sample-3',
    title: '저녁 가벼운 산책 또는 운동 30분',
    completed: false,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    priority: 'medium',
    category: '개인',
    notes: '스트레칭 포함',
    subtasks: [],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: null
  },
  {
    id: 'sample-4',
    title: '기술 서적 1챕터 읽기',
    completed: false,
    dueDate: '',
    priority: 'low',
    category: '공부',
    notes: '',
    subtasks: [],
    createdAt: new Date().toISOString(),
    completedAt: null
  }
];

let todos = [];
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'created_desc';
let isCompletedExpanded = true;
let editingTodoId = null;
let currentModalSubtasks = [];

// --- DOM 요소 캐싱 ---
const currentDateText = document.getElementById('currentDateText');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sunIcon = document.getElementById('sunIcon');
const halfMoonIcon = document.getElementById('halfMoonIcon');
const moonIcon = document.getElementById('moonIcon');
const themeLabelText = document.getElementById('themeLabelText');

const progressPercentage = document.getElementById('progressPercentage');
const progressSubtext = document.getElementById('progressSubtext');
const progressBar = document.getElementById('progressBar');

const todoForm = document.getElementById('todoForm');
const todoTitleInput = document.getElementById('todoTitleInput');
const todoDueDateInput = document.getElementById('todoDueDateInput');
const todoPriorityInput = document.getElementById('todoPriorityInput');
const todoCategoryInput = document.getElementById('todoCategoryInput');

const filterTabButtons = document.querySelectorAll('.filter-tab-btn');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

const activeSection = document.getElementById('activeSection');
const activeTodoList = document.getElementById('activeTodoList');
const emptyActiveState = document.getElementById('emptyActiveState');
const activeCountBadge = document.getElementById('activeCountBadge');

const completedSection = document.getElementById('completedSection');
const completedContainer = document.getElementById('completedContainer');
const completedTodoList = document.getElementById('completedTodoList');
const emptyCompletedState = document.getElementById('emptyCompletedState');
const completedCountBadge = document.getElementById('completedCountBadge');
const toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
const completedChevron = document.getElementById('completedChevron');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editTodoId = document.getElementById('editTodoId');
const editTodoTitle = document.getElementById('editTodoTitle');
const editTodoDueDate = document.getElementById('editTodoDueDate');
const editTodoPriority = document.getElementById('editTodoPriority');
const editTodoCategory = document.getElementById('editTodoCategory');
const editTodoNotes = document.getElementById('editTodoNotes');
const newSubtaskInput = document.getElementById('newSubtaskInput');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');
const modalSubtaskList = document.getElementById('modalSubtaskList');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// --- 초기화 함수 ---
function init() {
  initDateDisplay();
  initTheme();
  loadTodos();
  setupEventListeners();
  setupSupabaseRealtime();
  render();

  // 다른 탭이나 창에서 돌아왔을 때 데이터 자동 최신화
  window.addEventListener('focus', fetchFromSupabase);
}

// 상단 오늘 날짜 표시
function initDateDisplay() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  currentDateText.textContent = now.toLocaleDateString('ko-KR', options);

  // 기본 마감일은 오늘로 세팅 가능하도록 placeholder 지정
  const todayStr = now.toISOString().split('T')[0];
  todoDueDateInput.value = todayStr;
}

// 3단 테마 적용 (라이트 / 중간 모드 / 다크 모드)
function applyTheme(theme) {
  document.documentElement.classList.remove('dark', 'mid');
  sunIcon.classList.add('hidden');
  halfMoonIcon.classList.add('hidden');
  moonIcon.classList.add('hidden');

  if (theme === 'mid') {
    document.documentElement.classList.add('mid');
    halfMoonIcon.classList.remove('hidden');
    themeLabelText.textContent = '중간 모드';
    themeToggleBtn.title = '현재: 눈이 편안한 중간 모드 (클릭 시 다크 모드로 변경)';
  } else if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    moonIcon.classList.remove('hidden');
    themeLabelText.textContent = '다크 모드';
    themeToggleBtn.title = '현재: 다크 모드 (클릭 시 라이트 모드로 변경)';
  } else {
    // light 기본
    theme = 'light';
    sunIcon.classList.remove('hidden');
    themeLabelText.textContent = '라이트 모드';
    themeToggleBtn.title = '현재: 라이트 모드 (클릭 시 중간 모드로 변경)';
  }

  localStorage.setItem(THEME_KEY, theme);
}

// 테마 초기화
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);
}

// 테마 3단 순환 (라이트 -> 중간 -> 다크 -> 라이트)
function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || 'light';
  let next = 'mid';
  if (current === 'light') {
    next = 'mid';
  } else if (current === 'mid') {
    next = 'dark';
  } else {
    next = 'light';
  }
  applyTheme(next);
}

// DB 행 <-> 애플리케이션 할 일 객체 변환 헬퍼
function rowToTodo(row) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    dueDate: row.due_date || '',
    priority: row.priority || 'medium',
    category: row.category || '기타',
    notes: row.notes || '',
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    createdAt: row.created_at || new Date().toISOString(),
    completedAt: row.completed_at || null
  };
}

function todoToRow(todo) {
  return {
    id: todo.id,
    title: todo.title,
    completed: Boolean(todo.completed),
    due_date: todo.dueDate || null,
    priority: todo.priority || 'medium',
    category: todo.category || '기타',
    notes: todo.notes || '',
    subtasks: todo.subtasks || [],
    completed_at: todo.completedAt || null
  };
}

// 로컬 스토리지 로드 / 저장 (캐시 역할)
function loadTodos() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      todos = JSON.parse(stored);
    } catch (e) {
      todos = [...defaultTodos];
    }
  } else {
    todos = [...defaultTodos];
  }

  // Supabase 클라우드 데이터 비동기 동기화
  fetchFromSupabase();
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// Supabase 클라우드에서 최신 할 일 목록 가져오기
async function fetchFromSupabase() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase 데이터 로드 실패 (로컬 데이터 유지):', error.message);
      return;
    }

    if (data && data.length > 0) {
      todos = data.map(rowToTodo);
      saveTodos();
      render();
    } else if (data && data.length === 0 && todos.length > 0) {
      // Supabase 테이블이 비어있다면 초기 샘플 데이터를 업로드하여 동기화
      for (const t of todos) {
        await supabaseClient.from('todos').upsert([todoToRow(t)]);
      }
    }
  } catch (err) {
    console.warn('Supabase 동기화 오류:', err);
  }
}

// 실시간 구독 (다른 브라우저나 스마트폰에서 변경 시 자동 갱신)
function setupSupabaseRealtime() {
  if (!supabaseClient) return;
  try {
    supabaseClient
      .channel('realtime_todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        fetchFromSupabase();
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription not available:', e);
  }
}

// --- 핵심 비즈니스 로직 ---

// 새 할 일 등록
async function addTodo(title, dueDate, priority, category) {
  if (!title.trim()) return;

  const newTodo = {
    id: 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    completed: false,
    dueDate: dueDate || '',
    priority: priority || 'medium',
    category: category || '기타',
    notes: '',
    subtasks: [],
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  // 즉시 화면 반영 (낙관적 UI 업데이트)
  todos.unshift(newTodo);
  saveTodos();
  render();

  // Supabase 클라우드 저장
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('todos').insert([todoToRow(newTodo)]);
      if (error) console.error('Supabase 추가 에러:', error);
    } catch (e) {
      console.error(e);
    }
  }
}

// 완료 상태 토글 (진행중 <-> 완료 하단 이동)
async function toggleTodoComplete(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;

  saveTodos();
  render();

  // Supabase 클라우드 업데이트
  if (supabaseClient) {
    try {
      await supabaseClient
        .from('todos')
        .update({
          completed: todo.completed,
          completed_at: todo.completedAt
        })
        .eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }
}

// 삭제
async function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  render();

  // Supabase 클라우드 삭제
  if (supabaseClient) {
    try {
      await supabaseClient.from('todos').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  }
}

// 완료된 모든 할 일 비우기
async function clearCompleted() {
  const completedCount = todos.filter(t => t.completed).length;
  if (completedCount === 0) return;

  if (confirm(`완료된 항목 ${completedCount}개를 모두 삭제하시겠습니까?`)) {
    todos = todos.filter(t => !t.completed);
    saveTodos();
    render();

    // Supabase 클라우드 완료 항목 삭제
    if (supabaseClient) {
      try {
        await supabaseClient.from('todos').delete().eq('completed', true);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

// 정렬 헬퍼
function sortTodos(list, sortType) {
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  return list.slice().sort((a, b) => {
    if (sortType === 'due_asc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    } else if (sortType === 'priority_desc') {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else {
      // created_desc 기본
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });
}

// 마감일 상태 판별 뱃지
function getDueDateBadge(dueDate, isCompleted) {
  if (!dueDate) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dueDate);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

  let badgeClass = 'due-badge-normal';
  let label = dueDate;

  if (isCompleted) {
    badgeClass = 'due-badge-normal opacity-70';
    label = `${dueDate} (완료)`;
  } else if (diffDays < 0) {
    badgeClass = 'due-badge-overdue';
    label = `${Math.abs(diffDays)}일 지남 (${dueDate})`;
  } else if (diffDays === 0) {
    badgeClass = 'due-badge-today font-bold';
    label = '오늘 마감';
  } else if (diffDays === 1) {
    label = '내일 마감';
  } else {
    label = `D-${diffDays} (${dueDate})`;
  }

  return `<span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${badgeClass}">
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    ${label}
  </span>`;
}

// 우선순위 뱃지 라벨
function getPriorityBadge(priority) {
  const map = {
    high: { text: '높음', dot: 'bg-rose-500', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40' },
    medium: { text: '보통', dot: 'bg-amber-500', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' },
    low: { text: '낮음', dot: 'bg-emerald-500', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40' }
  };
  const item = map[priority] || map.medium;
  return `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${item.color}">
    <span class="w-1.5 h-1.5 rounded-full ${item.dot}"></span>
    ${item.text}
  </span>`;
}

// 카테고리 태그 뱃지
function getCategoryBadge(category) {
  return `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
    #${category}
  </span>`;
}

// 할 일 개별 카드 생성 HTML 템플릿
function createTodoItemHTML(todo) {
  const subtaskSummary = todo.subtasks && todo.subtasks.length > 0 
    ? `<span class="text-[11px] text-slate-400 flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        ${todo.subtasks.filter(s => s.completed).length}/${todo.subtasks.length}
       </span>`
    : '';

  const hasNotes = todo.notes ? `<svg class="w-3.5 h-3.5 text-slate-400" title="상세 메모 있음" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>` : '';

  return `
    <li data-id="${todo.id}" class="todo-card ${todo.completed ? 'completed-item' : ''} group flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
      <!-- 좌측 체크박스 & 제목 정보 -->
      <div class="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <input type="checkbox" ${todo.completed ? 'checked' : ''} 
          class="custom-checkbox todo-checkbox mt-0.5 sm:mt-0" 
          aria-label="${todo.title} 완료 여부">
        
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5 mb-1">
            ${getPriorityBadge(todo.priority)}
            ${getCategoryBadge(todo.category)}
            ${getDueDateBadge(todo.dueDate, todo.completed)}
            ${subtaskSummary}
            ${hasNotes}
          </div>
          <p class="todo-title text-sm font-medium text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-brand-600 dark:hover:text-brand-400">
            ${escapeHTML(todo.title)}
          </p>
        </div>
      </div>

      <!-- 우측 액션 버튼들 -->
      <div class="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" class="edit-todo-btn p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg transition" title="상세보기 및 수정">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button type="button" class="delete-todo-btn p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition" title="삭제">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  `;
}

// XSS 방지 escape
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// 메인 렌더링 함수
function render() {
  const totalCount = todos.length;
  const completedList = todos.filter(t => t.completed);
  const activeList = todos.filter(t => !t.completed);

  // 1. 프로그레스 바 갱신
  const completedCount = completedList.length;
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  progressPercentage.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
  progressSubtext.textContent = `총 ${totalCount}개의 할 일 중 ${completedCount}개 완료 (남은 할 일 ${activeList.length}개)`;

  // 2. 검색 및 카테고리 필터링 적용
  let filteredActive = activeList;
  let filteredCompleted = completedList;

  if (currentCategory !== 'all') {
    filteredActive = filteredActive.filter(t => t.category === currentCategory);
    filteredCompleted = filteredCompleted.filter(t => t.category === currentCategory);
  }

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    filteredActive = filteredActive.filter(t => 
      t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q))
    );
    filteredCompleted = filteredCompleted.filter(t => 
      t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  // 3. 정렬 적용
  filteredActive = sortTodos(filteredActive, currentSort);
  filteredCompleted = sortTodos(filteredCompleted, currentSort);

  // 4. 배지 카운트 갱신
  activeCountBadge.textContent = filteredActive.length;
  completedCountBadge.textContent = filteredCompleted.length;

  // 5. 상단 탭에 따른 영역 노출 제어
  if (currentFilter === 'active') {
    activeSection.classList.remove('hidden');
    completedSection.classList.add('hidden');
  } else if (currentFilter === 'completed') {
    activeSection.classList.add('hidden');
    completedSection.classList.remove('hidden');
  } else {
    // 'all'인 경우 둘 다 표시 (진행중 상단, 완료 하단)
    activeSection.classList.remove('hidden');
    completedSection.classList.remove('hidden');
  }

  // 6. 진행 중 목록 렌더링
  if (filteredActive.length === 0) {
    activeTodoList.innerHTML = '';
    emptyActiveState.classList.remove('hidden');
  } else {
    emptyActiveState.classList.add('hidden');
    activeTodoList.innerHTML = filteredActive.map(createTodoItemHTML).join('');
  }

  // 7. 완료된 목록 렌더링 (하단 전용 영역)
  if (filteredCompleted.length === 0) {
    completedTodoList.innerHTML = '';
    emptyCompletedState.classList.remove('hidden');
    clearCompletedBtn.classList.add('hidden');
  } else {
    emptyCompletedState.classList.add('hidden');
    clearCompletedBtn.classList.remove('hidden');
    completedTodoList.innerHTML = filteredCompleted.map(createTodoItemHTML).join('');
  }

  // 8. 완료 아코디언 컨테이너 접힘/펼침 제어
  if (isCompletedExpanded) {
    completedContainer.classList.remove('hidden');
    completedChevron.classList.add('rotate-90');
  } else {
    completedContainer.classList.add('hidden');
    completedChevron.classList.remove('rotate-90');
  }
}

// --- 모달 (상세보기 및 수정) 관리 ---
function openEditModal(todoId) {
  const todo = todos.find(t => t.id === todoId);
  if (!todo) return;

  editingTodoId = todoId;
  editTodoId.value = todo.id;
  editTodoTitle.value = todo.title;
  editTodoDueDate.value = todo.dueDate || '';
  editTodoPriority.value = todo.priority;
  editTodoCategory.value = todo.category;
  editTodoNotes.value = todo.notes || '';
  currentModalSubtasks = JSON.parse(JSON.stringify(todo.subtasks || []));

  renderModalSubtasks();

  editModal.classList.remove('opacity-0', 'pointer-events-none');
  editModal.querySelector('.transform').classList.remove('scale-95');
  editModal.querySelector('.transform').classList.add('scale-100');
  editTodoTitle.focus();
}

function closeEditModal() {
  editingTodoId = null;
  editModal.classList.add('opacity-0', 'pointer-events-none');
  editModal.querySelector('.transform').classList.add('scale-95');
  editModal.querySelector('.transform').classList.remove('scale-100');
}

function renderModalSubtasks() {
  modalSubtaskList.innerHTML = currentModalSubtasks.map((st, idx) => `
    <li class="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
      <label class="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
        <input type="checkbox" data-subidx="${idx}" ${st.completed ? 'checked' : ''} 
          class="subtask-checkbox custom-checkbox !w-4 !h-4">
        <span class="text-xs text-slate-700 dark:text-slate-300 truncate ${st.completed ? 'line-through text-slate-400' : ''}">
          ${escapeHTML(st.title)}
        </span>
      </label>
      <button type="button" data-subidx="${idx}" class="remove-subtask-btn text-slate-400 hover:text-rose-500 p-0.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </li>
  `).join('');
}

// --- 이벤트 리스너 세팅 ---
function setupEventListeners() {
  // 1. 테마 토글
  themeToggleBtn.addEventListener('click', toggleTheme);

  // 2. 빠른 할 일 등록 폼 제출
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = todoTitleInput.value;
    const dueDate = todoDueDateInput.value;
    const priority = todoPriorityInput.value;
    const category = todoCategoryInput.value;

    addTodo(title, dueDate, priority, category);
    todoTitleInput.value = '';
    todoTitleInput.focus();
  });

  // 3. 상태 탭 전환 (전체 / 진행 중 / 완료됨)
  filterTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // 4. 카테고리 필터 변경
  categoryFilter.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    render();
  });

  // 5. 검색창 실시간 입력
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  // 6. 정렬 셀렉트 변경
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    render();
  });

  // 7. 완료 목록 접기/펼치기 아코디언 토글
  toggleCompletedBtn.addEventListener('click', () => {
    isCompletedExpanded = !isCompletedExpanded;
    render();
  });

  // 8. 완료 항목 모두 비우기
  clearCompletedBtn.addEventListener('click', clearCompleted);

  // 9. 리스트 내 이벤트 위임 (체크박스 토글, 수정 모달 열기, 삭제)
  function handleListClick(e) {
    const card = e.target.closest('li[data-id]');
    if (!card) return;
    const id = card.dataset.id;

    if (e.target.matches('.todo-checkbox')) {
      toggleTodoComplete(id);
      return;
    }

    if (e.target.closest('.delete-todo-btn')) {
      deleteTodo(id);
      return;
    }

    if (e.target.closest('.edit-todo-btn') || e.target.closest('.todo-title')) {
      openEditModal(id);
      return;
    }
  }

  activeTodoList.addEventListener('click', handleListClick);
  completedTodoList.addEventListener('click', handleListClick);

  // 10. 모달 내부 이벤트들
  closeModalBtn.addEventListener('click', closeEditModal);
  cancelModalBtn.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // 하위 할 일 추가
  function addSubtask() {
    const val = newSubtaskInput.value.trim();
    if (!val) return;
    currentModalSubtasks.push({
      id: 'sub_' + Date.now(),
      title: val,
      completed: false
    });
    newSubtaskInput.value = '';
    renderModalSubtasks();
  }

  addSubtaskBtn.addEventListener('click', addSubtask);
  newSubtaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  });

  // 하위 할 일 체크 및 삭제 위임
  modalSubtaskList.addEventListener('change', (e) => {
    if (e.target.matches('.subtask-checkbox')) {
      const idx = parseInt(e.target.dataset.subidx, 10);
      currentModalSubtasks[idx].completed = e.target.checked;
      renderModalSubtasks();
    }
  });

  modalSubtaskList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.remove-subtask-btn');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.subidx, 10);
      currentModalSubtasks.splice(idx, 1);
      renderModalSubtasks();
      return;
    }
  });

  // 모달 폼 저장 제출
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingTodoId) return;

    const todo = todos.find(t => t.id === editingTodoId);
    if (todo) {
      todo.title = editTodoTitle.value.trim();
      todo.dueDate = editTodoDueDate.value;
      todo.priority = editTodoPriority.value;
      todo.category = editTodoCategory.value;
      todo.notes = editTodoNotes.value.trim();
      todo.subtasks = currentModalSubtasks;

      saveTodos();
      render();

      // Supabase 클라우드 동기화
      if (supabaseClient) {
        try {
          await supabaseClient.from('todos').update(todoToRow(todo)).eq('id', todo.id);
        } catch (err) {
          console.error(err);
        }
      }
    }
    closeEditModal();
  });

  // ESC 키로 모달 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('pointer-events-none')) {
      closeEditModal();
    }
  });
}

// 앱 실행
document.addEventListener('DOMContentLoaded', init);

