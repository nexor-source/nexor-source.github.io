document.getElementById("year").textContent = new Date().getFullYear();

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const skillNodes = document.querySelectorAll(".skill-node");

skillNodes.forEach((node) => {
  const button = node.querySelector(".skill-node-toggle");

  button.addEventListener("click", () => {
    const willOpen = !node.classList.contains("is-open");

    skillNodes.forEach((otherNode) => {
      otherNode.classList.remove("is-open");
      otherNode.querySelector(".skill-node-toggle").setAttribute("aria-expanded", "false");
    });

    if (willOpen) {
      node.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  skillNodes.forEach((node) => {
    node.classList.remove("is-open");
    node.querySelector(".skill-node-toggle").setAttribute("aria-expanded", "false");
  });
});
