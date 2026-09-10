const profiles = [
  { name: "Maya", age: 27, bio: "Ceramic artist · Sunday market regular", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85" },
  { name: "Theo", age: 29, bio: "Bookshop browser · Makes a mean tiramisu", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85" },
  { name: "Nina", age: 26, bio: "Film photographer · Looking for adventure", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85" },
  { name: "Leo", age: 30, bio: "Plant dad · Enthusiastic home cook", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=85" }
];

const stack = document.querySelector("#card-stack");
const count = document.querySelector("#seen-count");
const message = document.querySelector("#decision");
let current = 0;

function renderStack() {
  stack.innerHTML = "";
  if (current >= profiles.length) {
    stack.innerHTML = `<article class="profile-card placeholder"><span>That’s everyone for now ✨</span></article>`;
    return;
  }
  profiles.slice(current, current + 3).reverse().forEach((profile, reverseIndex) => {
    const index = current + (2 - reverseIndex);
    const depth = index - current;
    const card = document.createElement("article");
    card.className = "profile-card";
    card.style.transform = `scale(${1 - depth * .035}) translateY(${depth * 10}px)`;
    card.style.zIndex = 3 - depth;
    card.innerHTML = `<img src="${profile.image}" alt="${profile.name}, ${profile.age}" /><span class="badge like-badge">LIKE</span><span class="badge pass-badge">PASS</span><div class="profile-info"><h1>${profile.name}, ${profile.age}</h1><p>${profile.bio}</p></div>`;
    stack.append(card);
  });
}

function choose(kind) {
  if (current >= profiles.length) return;
  const card = stack.querySelector(".profile-card");
  const liked = kind === "like";
  stack.classList.add(liked ? "liking" : "passing");
  setTimeout(() => card.classList.add(liked ? "leaving-like" : "leaving-pass"), 100);
  message.textContent = liked ? `You liked ${profiles[current].name} ♥` : `Passed on ${profiles[current].name}`;
  message.classList.add("show");
  current++;
  count.textContent = current;
  setTimeout(() => { stack.className = "card-stack"; renderStack(); }, 510);
  setTimeout(() => message.classList.remove("show"), 1300);
}

document.querySelector("#like-button").addEventListener("click", () => choose("like"));
document.querySelector("#dislike-button").addEventListener("click", () => choose("pass"));
document.addEventListener("keydown", event => {
  if (event.key === "ArrowRight") choose("like");
  if (event.key === "ArrowLeft") choose("pass");
});
renderStack();
