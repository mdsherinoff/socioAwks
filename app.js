const SUPABASE_URL = "https://qocqpbcjynjrbvdttttr.supabase.co";
const SUPABASE_KEY = "sb_publishable_TrLn2qqJs_XzMeZitCrdsg_lIR4x8Lh";

function getSupabaseGlobal() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.supabase && typeof window.supabase.createClient === "function") {
    return window.supabase;
  }

  if (
    window.supabaseJs &&
    typeof window.supabaseJs.createClient === "function"
  ) {
    return window.supabaseJs;
  }

  return null;
}

const supabaseLib = getSupabaseGlobal();
const client = supabaseLib
  ? supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const authRoot = document.getElementById("auth");
const feedRoot = document.getElementById("feed");
const postInput = document.getElementById("postContent");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const postBtn = document.getElementById("postBtn");

const isLoginPage = Boolean(authRoot);
const isChatPage = Boolean(feedRoot);

function showError(error, fallbackMessage) {
  const message =
    error && typeof error === "object" && "message" in error
      ? error.message
      : fallbackMessage;
  alert(message);
}

function requireClient() {
  if (client) {
    return true;
  }

  showError(null, "Supabase failed to load. Refresh the page and try again.");
  return false;
}

function renderFeedMessage(message) {
  if (!feedRoot) {
    return;
  }

  feedRoot.innerHTML = "";

  const notice = document.createElement("div");
  notice.className = "feed-empty";
  notice.textContent = message;
  feedRoot.appendChild(notice);
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureProfile(user, fallbackUsername = "") {
  if (!requireClient() || !user) {
    return { ok: false, skipped: true };
  }

  const metadataUsername = normalizeUsername(user.user_metadata?.username);
  const username = normalizeUsername(fallbackUsername) || metadataUsername;

  if (!username) {
    return { ok: false, skipped: true };
  }

  const { error } = await client.from("profiles").upsert(
    {
      id: user.id,
      username,
    },
    { onConflict: "id" },
  );

  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}

async function signup() {
  if (!requireClient()) {
    return;
  }

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const usernameInput = document.getElementById("username");

  if (!emailInput || !passwordInput || !usernameInput) {
    showError(null, "The signup form is missing required fields.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = normalizeUsername(usernameInput.value);

  if (!email || !password || !username) {
    alert("Email, password, and username are required for signup.");
    return;
  }

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      showError(error, "Signup failed.");
      return;
    }

    const user = data.user;
    const session = data.session;

    if (!user) {
      alert("Signup created. Check your email for confirmation before login.");
      return;
    }

    if (!session) {
      alert(
        "Signup successful. Check your email for confirmation, then log in.",
      );
      return;
    }

    const profileResult = await ensureProfile(user, username);

    if (!profileResult.ok) {
      showError(
        profileResult.error,
        "Your account was created, but the profile could not be saved.",
      );
      return;
    }

    alert("Signup successful! You can log in now.");
  } catch (error) {
    showError(error, "Something went wrong during signup.");
  }
}

async function login() {
  if (!requireClient()) {
    return;
  }

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (!emailInput || !passwordInput) {
    showError(null, "The login form is missing required fields.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Email and password are required.");
    return;
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showError(error, "Login failed.");
      return;
    }

    const profileResult = await ensureProfile(data.user);

    if (!profileResult.ok && !profileResult.skipped) {
      showError(
        profileResult.error,
        "Logged in, but your profile could not be prepared.",
      );
      return;
    }

    window.location.href = "chat.html";
  } catch (error) {
    showError(error, "Something went wrong during login.");
  }
}

async function logout() {
  if (!requireClient()) {
    return;
  }

  try {
    const { error } = await client.auth.signOut();

    if (error) {
      showError(error, "Logout failed.");
      return;
    }

    window.location.href = "login.html";
  } catch (error) {
    showError(error, "Something went wrong during logout.");
  }
}

async function createPost() {
  if (!requireClient()) {
    return;
  }

  if (!postInput) {
    showError(null, "Post input not found.");
    return;
  }

  const content = postInput.value.trim();

  if (!content) {
    alert("Please type something!");
    return;
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      showError(userError, "You must be logged in to post.");
      return;
    }

    const { error } = await client.from("posts").insert({
      content,
      user_id: user.id,
    });

    if (error) {
      showError(error, "Your post could not be created.");
      return;
    }

    postInput.value = "";
    await loadPosts();
  } catch (error) {
    showError(error, "Something went wrong while posting.");
  }
}

async function loadPosts() {
  if (!requireClient() || !feedRoot) {
    return;
  }

  try {
    const { data: posts, error: postError } = await client
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (postError) {
      showError(postError, "Posts could not be loaded.");
      renderFeedMessage("Unable to load posts right now.");
      return;
    }

    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, username");

    if (profileError) {
      showError(profileError, "Profiles could not be loaded.");
      renderFeedMessage("Unable to load usernames right now.");
      return;
    }

    if (!posts || posts.length === 0) {
      renderFeedMessage("No posts yet. Start the conversation.");
      return;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.id, profile.username]),
    );

    feedRoot.innerHTML = "";

    posts.forEach((post) => {
      const username = profileMap.get(post.user_id) || "unknown";
      const parsedDate = new Date(post.created_at);
      const postTime = Number.isNaN(parsedDate.getTime())
        ? "--:--"
        : parsedDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

      const line = document.createElement("div");
      line.className = "chat-line";

      const time = document.createElement("span");
      time.className = "msg-time";
      time.textContent = `[${postTime}]`;

      const user = document.createElement("span");
      user.className = "msg-user";
      user.textContent = `<${username}>`;

      const text = document.createElement("span");
      text.className = "msg-text";
      text.textContent = post.content || "";

      line.append(time, user, text);
      feedRoot.appendChild(line);
    });
  } catch (error) {
    showError(error, "Something went wrong while loading posts.");
    renderFeedMessage("Unable to load the feed right now.");
  }
}

async function init() {
  if (!requireClient()) {
    if (isChatPage) {
      renderFeedMessage("Supabase is unavailable. Refresh to retry.");
    }
    return;
  }

  try {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error) {
      showError(error, "Session lookup failed.");
      return;
    }

    if (isLoginPage && session) {
      window.location.href = "chat.html";
      return;
    }

    if (isChatPage && !session) {
      window.location.href = "login.html";
      return;
    }

    if (session?.user) {
      const profileResult = await ensureProfile(session.user);

      if (!profileResult.ok && !profileResult.skipped) {
        showError(
          profileResult.error,
          "Your profile could not be prepared for this session.",
        );
        return;
      }
    }

    if (isChatPage && session) {
      await loadPosts();
    }
  } catch (error) {
    showError(error, "The app could not be initialized.");
  }
}

if (client) {
  client.auth.onAuthStateChange(async (_event, session) => {
    if (isLoginPage && session) {
      window.location.href = "chat.html";
      return;
    }

    if (isChatPage && !session) {
      window.location.href = "login.html";
      return;
    }

    if (isChatPage && session) {
      await loadPosts();
    }
  });
}

if (postInput) {
  postInput.addEventListener("keydown", async (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      await createPost();
    }
  });
}

if (signupBtn) {
  signupBtn.addEventListener("click", signup);
}

if (loginBtn) {
  loginBtn.addEventListener("click", login);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

if (postBtn) {
  postBtn.addEventListener("click", createPost);
}

init();
