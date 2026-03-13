from django.urls import path
from . import views

urlpatterns = [
    path('products/', views.ProductListView.as_view(), name='products'),
    path('products/<int:pk>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('categories/', views.CategoryListView.as_view(), name='categories'),
    path('admin/products/', views.admin_create_product, name='admin-create-product'),
    path('admin/products/<int:pk>/', views.admin_manage_product, name='admin-manage-product'),
    path('orders/', views.create_order, name='create-order'),
    path('orders/mine/', views.my_orders, name='my-orders'),
    path('orders/<int:order_id>/payment/', views.upload_payment, name='upload-payment'),
    path('admin/orders/', views.admin_orders, name='admin-orders'),
    path('admin/orders/<int:order_id>/status/', views.admin_update_order_status, name='admin-order-status'),
]