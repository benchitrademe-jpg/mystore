function renderCart() {

    const container = document.getElementById("cart-items");

    if (!container) return;

    container.innerHTML = "";

    if (cart.length === 0) {

        container.innerHTML = "<h2>Your cart is empty.</h2>";

        return;

    }

    let total = 0;

    cart.forEach((item,index)=>{

        total += item.price * item.quantity;

        const div=document.createElement("div");

        div.className="product-card";

        div.innerHTML=`

            <h2>${item.name}</h2>

            <p>SKU: ${item.sku}</p>

            <h3>$${item.price.toFixed(2)}</h3>

            <br>

            <button class="minus">−</button>

            <strong style="margin:0 20px;">${item.quantity}</strong>

            <button class="plus">+</button>

            <br><br>

            <strong>Subtotal $${(item.price*item.quantity).toFixed(2)}</strong>

            <br><br>

            <button class="remove">Remove</button>

        `;

        div.querySelector(".plus").onclick=()=>{

            cart[index].quantity++;

            saveCart();

            updateCartCount();

            renderCart();

        };

        div.querySelector(".minus").onclick=()=>{

            if(cart[index].quantity>1){

                cart[index].quantity--;

            }else{

                cart.splice(index,1);

            }

            saveCart();

            updateCartCount();

            renderCart();

        };

        div.querySelector(".remove").onclick=()=>{

            cart.splice(index,1);

            saveCart();

            updateCartCount();

            renderCart();

        };

        container.appendChild(div);

    });

    const totalDiv=document.createElement("div");

    totalDiv.className="product-card";

    totalDiv.innerHTML=`

        <h2>Total</h2>

        <h1>$${total.toFixed(2)}</h1>

        <br>

        <button id="emptyCart">Empty Cart</button>

    `;

    container.appendChild(totalDiv);

    document.getElementById("emptyCart").onclick=()=>{

        if(confirm("Empty cart?")){

            cart=[];

            saveCart();

            updateCartCount();

            renderCart();

        }

    };

}

renderCart();