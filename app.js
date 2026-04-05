const SUPABASE_URL = "https://qocqpbcjynjrbvdttttr.supabase.co";
const SUPABASE_KEY = "sb_publishable_TrLn2qqJs_XzMeZitCrdsg_lIR4x8Lh";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SIGN UP
async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await client.auth.signUp({ email, password });
  alert(error ? error.message : "Signed up!");
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

// CREATE POST
async function createPost() {
  const content = document.getElementById("postContent").value;

  // Get logged-in user
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    alert("You must be logged in to post!");
    return;
  }

  // Insert post with user_id
  const { error } = await client.from("posts").insert([
    {
      content: content,
      user_id: user.id,
    },
  ]);

  if (error) {
    alert(error.message);
  } else {
    document.getElementById("postContent").value = "";
    loadPosts();
  }
}

// LOAD POSTS
async function loadPosts() {
  const { data, error } = await client
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  const feed = document.getElementById("feed");
  feed.innerHTML = "";

  data.forEach((post) => {
    const div = document.createElement("div");
    div.innerText = post.content;
    feed.appendChild(div);
  });
}

loadPosts();
