const SUPABASE_URL = "https://qocqpbcjynjrbvdttttr.supabase.co";
const SUPABASE_KEY = "sb_publishable_TrLn2qqJs_XzMeZitCrdsg_lIR4x8Lh";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SIGN UP
async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const username = document.getElementById("username").value;

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  const user = data.user;

  // Insert into profiles table
  const { error: profileError } = await client.from("profiles").insert([
    {
      id: user.id,
      username: username,
    },
  ]);

  if (profileError) {
    alert(profileError.message);
  } else {
    alert("Signup successful!");
  }
}

// LOGIN
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  alert(error ? error.message : "Logged in!");
}

async function createPost() {
  const input = document.getElementById("postContent");
  const content = input.value.trim();

  // Prevent empty or whitespace-only posts
  if (content.length === 0) {
    showToast("Please type something!");
    return;
  }

  // Get logged-in user
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    alert("You must be logged in to post!");
    return;
  }

  // Insert post
  const { error } = await client.from("posts").insert([
    {
      content: content,
      user_id: user.id,
    },
  ]);

  if (error) {
    alert(error.message);
  } else {
    input.value = "";
    loadPosts();
  }
}

// LOAD POSTS
async function loadPosts() {
  const { data: posts } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profiles } = await client.from("profiles").select("*");

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

loadPosts();
