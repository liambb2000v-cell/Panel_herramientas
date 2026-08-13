const searchInput = document.getElementById("searchInput");
const toolCards = document.querySelectorAll(".tool-card");

searchInput.addEventListener("input", () => {
    const search = searchInput.value.toLowerCase().trim();

        toolCards.forEach(card => {
                const name = card.querySelector("h3").textContent.toLowerCase();
                        const description = card.querySelector("p").textContent.toLowerCase();

                                const matches =
                                            name.includes(search) ||
                                                        description.includes(search);

                                                                card.style.display = matches ? "flex" : "none";
                                                                    });
                                                                    });