export const ID_KEY = 'sharing_app_user_id';
export const CHAT_HISTORY_KEY = 'sharing_app_chat_history';

// Generate a random 12 digit string
export const generateId = () => {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

export const getSavedId = () => {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
};

export const getChatHistory = () => {
  const history = localStorage.getItem(CHAT_HISTORY_KEY);
  return history ? JSON.parse(history) : [];
};

export const saveChatHistory = (history) => {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
};
