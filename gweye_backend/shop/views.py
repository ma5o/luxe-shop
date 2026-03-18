from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from .models import Product, ProductImage, Category, Order, OrderItem
from .serializers import ProductSerializer, CategorySerializer, OrderSerializer


# ─── SHOP PUBLIC ────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    products = Product.objects.filter(is_active=True)
    q = request.query_params.get('q')
    cat = request.query_params.get('category')
    if q:
        products = products.filter(name__icontains=q)
    if cat:
        products = products.filter(category__slug=cat)
    return Response(ProductSerializer(products, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_list(request):
    return Response(CategorySerializer(Category.objects.all(), many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order(request):
    items_data = request.data.get('items', [])
    if not items_data:
        return Response({'error': 'Aucun article'}, status=400)

    total = 0
    order = Order.objects.create(
        user=request.user,
        shipping_address=request.data.get('shipping_address', ''),
        notes=request.data.get('notes', ''),
        total_price=0
    )

    for item in items_data:
        try:
            product = Product.objects.get(id=item['product_id'], is_active=True)
            qty = int(item.get('quantity', 1))
            OrderItem.objects.create(order=order, product=product, quantity=qty, price=product.price)
            total += product.price * qty
        except Product.DoesNotExist:
            pass

    order.total_price = total
    order.save()
    return Response(OrderSerializer(order).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_orders(request):
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_payment(request, order_id):
    try:
        order = Order.objects.get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable'}, status=404)

    if 'payment_screenshot' not in request.FILES:
        return Response({'error': 'Aucun fichier'}, status=400)

    order.payment_screenshot = request.FILES['payment_screenshot']
    order.status = 'payment_uploaded'
    order.save()
    return Response(OrderSerializer(order).data)


# ─── ADMIN ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_product_list(request):
    return Response(ProductSerializer(Product.objects.all(), many=True).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def admin_create_product(request):
    data = request.data.copy()
    is_active_val = data.get('is_active', 'true')
    data['is_active'] = str(is_active_val).lower() in ('true', '1', 'yes')

    serializer = ProductSerializer(data=data)
    if serializer.is_valid():
        product = serializer.save()

        # Traiter les images supplémentaires
        images = request.FILES.getlist('images')
        for i, img in enumerate(images):
            ProductImage.objects.create(product=product, image=img, order=i)

        return Response(ProductSerializer(product).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['PATCH', 'PUT'])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def admin_update_product(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({'error': 'Produit introuvable'}, status=404)

    data = request.data.copy()
    if 'is_active' in data:
        data['is_active'] = str(data['is_active']).lower() in ('true', '1', 'yes')

    serializer = ProductSerializer(product, data=data, partial=True)
    if serializer.is_valid():
        product = serializer.save()

        # Nouvelles images supplémentaires
        images = request.FILES.getlist('images')
        for i, img in enumerate(images):
            ProductImage.objects.create(product=product, image=img, order=product.images.count() + i)

        return Response(ProductSerializer(product).data)
    return Response(serializer.errors, status=400)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_product(request, product_id):
    try:
        Product.objects.get(id=product_id).delete()
        return Response({'success': True})
    except Product.DoesNotExist:
        return Response({'error': 'Produit introuvable'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_product_image(request, image_id):
    try:
        ProductImage.objects.get(id=image_id).delete()
        return Response({'success': True})
    except ProductImage.DoesNotExist:
        return Response({'error': 'Image introuvable'}, status=404)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_orders(request):
    orders = Order.objects.all().order_by('-created_at')
    status = request.query_params.get('status')
    if status:
        orders = orders.filter(status=status)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_update_order_status(request, order_id):
    try:
        order = Order.objects.get(id=order_id)
        order.status = request.data.get('status', order.status)
        order.save()
        return Response(OrderSerializer(order).data)
    except Order.DoesNotExist:
        return Response({'error': 'Commande introuvable'}, status=404)