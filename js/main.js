/* ===========================
   Cart Popup
=========================== */

#cart-popup{
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.45);

    display:flex;
    justify-content:center;
    align-items:center;

    opacity:0;
    visibility:hidden;

    transition:.25s;

    z-index:9999;
}

#cart-popup.show{
    opacity:1;
    visibility:visible;
}

.popup-box{

    background:white;

    padding:35px;

    border-radius:18px;

    text-align:center;

    width:340px;

    box-shadow:0 20px 60px rgba(0,0,0,.35);

    animation:popup .25s ease;
}

.popup-icon{

    font-size:60px;

    margin-bottom:15px;
}

.popup-box h2{

    margin:10px 0;

    color:#1c7c38;

    font-size:28px;
}

.popup-box p{

    color:#666;

    font-size:18px;
}

@keyframes popup{

    from{
        transform:scale(.8);
        opacity:0;
    }

    to{
        transform:scale(1);
        opacity:1;
    }

}
