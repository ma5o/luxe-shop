from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('products/',                        views.product_list,           name='product-list'),
    path('categories/',                      views.category_list,          name='category-list'),
    path('orders/',                          views.create_order,           name='create-order'),
    path('orders/mine/',                     views.my_orders,              name='my-orders'),
    path('orders/<int:order_id>/payment/',   views.upload_payment,         name='upload-payment'),
    # Admin
    path('admin/products/',                  views.admin_create_product,   name='admin-create-product'),
    path('admin/products/<int:product_id>/', views.admin_update_product,   name='admin-update-product'),
    path('admin/products/<int:product_id>/delete/', views.admin_delete_product, name='admin-delete-product'),
    path('admin/products/images/<int:image_id>/delete/', views.admin_delete_product_image, name='admin-delete-image'),
    path('admin/orders/',                    views.admin_orders,           name='admin-orders'),
    path('admin/orders/<int:order_id>/status/', views.admin_update_order_status, name='admin-update-order'),
]