const SUPABASE_URL = "https://qocqpbcjynjrbvdttttr.supabase.co";
const SUPABASE_KEY = "sb_publishable_TrLn2qqJs_XzMeZitCrdsg_lIR4x8Lh";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const isLoginPage = !!document.getElementById("auth");
const isChatPage = !!document.getElementById("feed");

// SIGN UP
async function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const username = document.getElementById("username").value.trim();

  if (!email || !password || !username) {
    alert("Email, password, and username are required for signup.");
    return;
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  const user = data.user;

  if (!user) {
    alert("Signup created. Check your email for confirmation before login.");
    return;
  }

  const { error: profileError } = await client.from("profiles").upsert([
    {
      id: user.id,
      username,
    },
  ]);

  if (profileError) {
    alert(profileError.message);
  } else {
    alert("Signup successful! You can log in now.");
  }
}

// LOGIN
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  window.location.href = "chat.html";
}

async function logout() {
  const { error } = await client.auth.signOut();
  if (error) {
    alert(error.message);
    return;
  }
  window.location.href = "login.html";
}

async function createPost() {
  const input = document.getElementById("postContent");
  const content = input.value.trim();

  if (!content) {
    alert("Please type something!");
    return;
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    alert("You must be logged in to post!");
    return;
  }

  const { error } = await client.from("posts").insert([
    {
      content,
      user_id: user.id,
    },
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  input.value = "";
  await loadPosts();
}

// LOAD POSTS
async function loadPosts() {
  const { data: posts, error: postError } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (postError) {
    alert(postError.message);
    return;
  }

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("*");

  if (profileError) {
    alert(profileError.message);
    return;
  }

  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  posts.forEach((post) => {
    const profile = profiles.find((p) => p.id === post.user_id);
    const username = profile ? profile.username : "unknown";
    const postTime = new Date(post.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const line = document.createElement("div");
    line.className = "chat-line";

    const time = document.createElement("span");
    time.className = "msg-time";
    time.innerText = `[${postTime}]`;

    const user = document.createElement("span");
    user.className = "msg-user";
    user.innerText = `<${username}>`;

    const text = document.createElement("span");
    text.className = "msg-text";
    text.innerText = post.content;

    line.append(time, user, text);
    feed.appendChild(line);
  });
}

async function init() {
  const {
    data: { session },
  } = await client.auth.getSession();

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
}

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

init();
