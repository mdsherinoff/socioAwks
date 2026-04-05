const SUPABASE_URL = "https://qocqpbcjynjrbvdttttr.supabase.co";
const SUPABASE_KEY = "sb_publishable_TrLn2qqJs_XzMeZitCrdsg_lIR4x8Lh";

const client =
  window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY) || null;

const authRoot = document.getElementById("auth");
const feedRoot = document.getElementById("feed");
const postInput = document.getElementById("postContent");
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const postBtn = document.getElementById("postBtn");

const isLoginPage = !!authRoot;
const isChatPage = !!feedRoot;

function showError(error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  alert(message);
}

function requireClient() {
  if (!client) {
    showError(null, "Supabase failed to load. Refresh the page and try again.");
    return false;
  }
  return true;
}

function normalizeUsername(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureProfile(user, fallbackUsername = "") {
  if (!requireClient() || !user) return { ok: false, skipped: true };

  const username =
    normalizeUsername(fallbackUsername) ||
    normalizeUsername(user.user_metadata?.username);
  if (!username) return { ok: false, skipped: true };

  const { error } = await client
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id" });

  if (error) return { ok: false, error };
  return { ok: true };
}

async function signup() {
  if (!requireClient()) return;

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const username = normalizeUsername(
    document.getElementById("username")?.value,
  );

  if (!email || !password || !username) {
    alert("Email, password, and username are required for signup.");
    return;
  }

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) return showError(error, "Signup failed.");
    if (!data.user)
      return alert("Signup created. Check your email for confirmation.");

    const profileResult = await ensureProfile(data.user, username);
    if (!profileResult.ok)
      return showError(profileResult.error, "Profile could not be saved.");

    alert("Signup successful! You can log in now.");
  } catch (err) {
    showError(err, "Something went wrong during signup.");
  }
}

async function login() {
  if (!requireClient()) return;

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Email and password are required.");
    return;
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return showError(error, "Login failed.");

    const profileResult = await ensureProfile(data.user);
    if (!profileResult.ok && !profileResult.skipped)
      showError(profileResult.error, "Profile could not be prepared.");

    window.location.href = "chat.html";
  } catch (err) {
    showError(err, "Something went wrong during login.");
  }
}

async function logout() {
  if (!requireClient()) return;

  try {
    const { error } = await client.auth.signOut();
    if (error) return showError(error, "Logout failed.");

    window.location.href = "login.html";
  } catch (err) {
    showError(err, "Something went wrong during logout.");
  }
}

async function createPost() {
  if (!requireClient() || !postInput)
    return showError(null, "Post input not found.");

  const content = postInput.value.trim();
  if (!content) return alert("Please type something!");

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user)
      return showError(userError, "You must be logged in to post.");

    const { error } = await client
      .from("posts")
      .insert({ content, user_id: user.id });
    if (error) return showError(error, "Your post could not be created.");

    postInput.value = "";
    await loadPosts();
  } catch (err) {
    showError(err, "Something went wrong while posting.");
  }
}

async function loadPosts() {
  if (!requireClient() || !feedRoot) return;

  try {
    const { data: posts, error: postError } = await client
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (postError) return showError(postError, "Posts could not be loaded.");

    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, username");
    if (profileError)
      return showError(profileError, "Profiles could not be loaded.");

    if (!posts || posts.length === 0) {
      feedRoot.innerHTML =
        '<div class="feed-empty">No posts yet. Start the conversation.</div>';
      return;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p.username]));
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

      line.innerHTML = `<span class="msg-time">[${postTime}]</span><span class="msg-user">&lt;${username}&gt;</span><span class="msg-text">${post.content || ""}</span>`;
      feedRoot.appendChild(line);
    });
  } catch (err) {
    showError(err, "Something went wrong while loading posts.");
    feedRoot.innerHTML =
      '<div class="feed-empty">Unable to load the feed right now.</div>';
  }
}

async function init() {
  if (!requireClient()) return;

  try {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error) return showError(error, "Session lookup failed.");

    if (isLoginPage && session) window.location.href = "chat.html";
    if (isChatPage && !session) window.location.href = "login.html";

    if (session?.user) {
      const profileResult = await ensureProfile(session.user);
      if (!profileResult.ok && !profileResult.skipped)
        showError(profileResult.error, "Profile could not be prepared.");
    }

    if (isChatPage && session) await loadPosts();
  } catch (err) {
    showError(err, "The app could not be initialized.");
  }
}

// Auth state changes
if (client) {
  client.auth.onAuthStateChange(async (_event, session) => {
    if (isLoginPage && session) window.location.href = "chat.html";
    if (isChatPage && !session) window.location.href = "login.html";
    if (isChatPage && session) await loadPosts();
  });
}

// Event listeners
postInput?.addEventListener("keydown", async (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    await createPost();
  }
});
signupBtn?.addEventListener("click", signup);
loginBtn?.addEventListener("click", login);
logoutBtn?.addEventListener("click", logout);
postBtn?.addEventListener("click", createPost);

init();
