let cart = JSON.parse(localStorage.getItem("cart")) || [];

function renderCart() {

    const container = document.getElementById("cart-items");
    const totalEl = document.getElementById("cart-total");

    container.innerHTML = "";

    let total = 0;

    cart.forEach((item, index) => {

        total += item.price * item.quantity;

        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            
            <div class="cart-info">
                <h3>${item.name}</h3>
                <p>$${item.price.toFixed(2)}</p>
                <p>Qty: ${item.quantity}</p>
            </div>

            <button onclick="removeItem(${index})">Remove</button>
        `;

        container.appendChild(div);

    });

    totalEl.textContent = total.toFixed(2);
}

function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
}

renderCart();
