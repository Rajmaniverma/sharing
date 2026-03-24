

export const ID_KEY = 'sharing_app_user_id';
export const CHAT_HISTORY_KEY = 'sharing_app_chat_history';

// Generate a random 12 digit string
export const generateId = () => {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
};
export const getSavedId = () => {
  let id = sessionStorage.getItem(ID_KEY);

  if (!id) {
    id = generateId();
    sessionStorage.setItem(ID_KEY, id);
  }

  return id;
};

export const getChatHistory = () => {
  const history = sessionStorage.getItem(CHAT_HISTORY_KEY);
  return history ? JSON.parse(history) : [];
};

export const saveChatHistory = (history) => {
  sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
};


