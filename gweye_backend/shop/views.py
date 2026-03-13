from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.db.models import Q
from .models import Product, Category, Order, OrderItem
from .serializers import (ProductSerializer, CategorySerializer,
                           OrderSerializer, CreateOrderSerializer)


# ─── Products ────────────────────────────────────────────────────────────────

class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_active=True)
        q = self.request.query_params.get('q', '')
        category = self.request.query_params.get('category', '')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        if category:
            qs = qs.filter(category__slug=category)
        return qs.order_by('-created_at')


class ProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def admin_create_product(request):
    data = request.data.copy()
    # Convertir "true"/"false" string en vrai booléen
    is_active_val = data.get('is_active', 'true')
    data['is_active'] = str(is_active_val).lower() in ('true', '1', 'yes')
    serializer = ProductSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    print("ERREURS PRODUIT:", serializer.errors)
    return Response(serializer.errors, status=400)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([permissions.IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def admin_manage_product(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({'error': 'Produit non trouvé.'}, status=404)

    if request.method == 'DELETE':
        product.delete()
        return Response({'message': 'Produit supprimé.'})

    serializer = ProductSerializer(product, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


# ─── Orders ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
def create_order(request):
    serializer = CreateOrderSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    data = serializer.validated_data
    order = Order.objects.create(
        user=request.user,
        shipping_address=data.get('shipping_address', ''),
        notes=data.get('notes', ''),
    )

    total = 0
    for item_data in data['items']:
        try:
            product = Product.objects.get(id=item_data['product_id'])
            qty = int(item_data['quantity'])
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=qty,
                unit_price=product.price
            )
            total += product.price * qty
        except Product.DoesNotExist:
            pass

    order.total_price = total
    order.save()
    return Response(OrderSerializer(order).data, status=201)


@api_view(['GET'])
def my_orders(request):
    orders = Order.objects.filter(user=request.user)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_payment(request, order_id):
    try:
        order = Order.objects.get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({'error': 'Commande non trouvée.'}, status=404)

    if 'payment_screenshot' not in request.FILES:
        return Response({'error': 'Aucun fichier fourni.'}, status=400)

    order.payment_screenshot = request.FILES['payment_screenshot']
    order.status = 'payment_uploaded'
    order.save()
    return Response(OrderSerializer(order).data)


# ─── Admin Orders ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def admin_orders(request):
    orders = Order.objects.all()
    status_filter = request.query_params.get('status', '')
    if status_filter:
        orders = orders.filter(status=status_filter)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(['PATCH'])
@permission_classes([permissions.IsAdminUser])
def admin_update_order_status(request, order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({'error': 'Commande non trouvée.'}, status=404)

    new_status = request.data.get('status')
    if new_status not in dict(Order.STATUS_CHOICES):
        return Response({'error': 'Statut invalide.'}, status=400)

    order.status = new_status
    order.save()
    return Response(OrderSerializer(order).data)